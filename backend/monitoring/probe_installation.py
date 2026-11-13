"""Versioned installation profile. Never infer a public control URL from request headers."""

import os
import re
from urllib.parse import urlsplit
from django.conf import settings
from rest_framework.exceptions import ValidationError

VERSION = "1.8.0"


def profile(probe, platform="linux", distribution="registry"):
    if platform not in ("linux", "windows") or distribution not in ("registry", "local"):
        raise ValidationError("Plataforma o distribución no válida.")
    server = os.environ.get("SENTI9_CONTROL_URL", "").rstrip("/")
    parsed = urlsplit(server)
    try:
        valid_port = parsed.port is None or 1 <= parsed.port <= 65535
    except ValueError:
        valid_port = False
    development = settings.DEBUG and parsed.scheme == "http"
    configured = bool(
        parsed.hostname
        and valid_port
        and not parsed.username
        and not parsed.password
        and not parsed.query
        and not parsed.fragment
        and parsed.scheme in ("https", "http")
        and (parsed.scheme == "https" or development)
        and parsed.path in ("", "/")
    )
    configured = configured and not bool(re.search(r"[\s\"'$`;]", server))
    identifier = str(probe.pk).split("-")[0]
    name, volume = f"senti9-{identifier}", f"senti9-{identifier}-state"
    image = os.environ.get("SENTI9_IMAGE", f"davis1924/senti9:{VERSION}")
    if not re.fullmatch(r"[a-zA-Z0-9._/:@-]+", image):
        raise ValidationError("Referencia de imagen no válida.")
    available = os.environ.get("SENTI9_DISTRIBUTION_READY", "false").lower() == "true"
    args = [
        "docker run -d",
        f"--name {name}",
        "--restart unless-stopped",
        "--pull never" if distribution == "local" else "--pull always",
        "--user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges:true",
        "--pids-limit 128 --memory 256m --cpus 1",
        "--tmpfs /tmp:rw,noexec,nosuid,size=16m,mode=1777",
        f"--mount source={volume},target=/data",
    ]
    if platform == "linux" and development:
        args += ["--add-host host.docker.internal:host-gateway"]
    token_path = "${TokenPath}" if platform == "windows" else "${TOKEN_PATH}"
    args += [
        f'--mount "type=bind,source={token_path},target=/run/secrets/sentinine_token,readonly"',
        "-e SENTININE_TOKEN_FILE=/run/secrets/sentinine_token",
    ]
    if development:
        args += ["-e SENTININE_ENV=development -e SENTININE_ALLOW_HTTP=true"]
    args += [f'-e SENTININE_SERVER="{server}"', image]
    join = " `\n  " if platform == "windows" else " \\\n  "
    preparation = (
        "$TokenPath = (Resolve-Path -LiteralPath 'C:\\RUTA_PRIVADA\\senti9-token.txt').Path"
        if platform == "windows"
        else 'TOKEN_PATH=\'/RUTA_PRIVADA/senti9-token.txt\'\n# Guarda fuera de carpetas compartidas; UID 10001 debe poder leer.\nsudo chown 10001:10001 "$TOKEN_PATH"\nsudo chmod 0400 "$TOKEN_PATH"'
    )
    return {
        "schema_version": 1,
        "version": VERSION,
        "platform": platform,
        "distribution": distribution,
        "server_url": server if configured else None,
        "configured": configured,
        "distribution_ready": available,
        "image": image,
        "container_name": name,
        "volume_name": volume,
        "token_preparation": preparation,
        "command": join.join(args) if configured else "",
        "diagnostic_command": f"docker exec {name} python -m diagnostics",
        "status_command": f"docker exec {name} python -m delivery status",
        "drain_command": f"docker exec {name} python -m delivery drain",
        "resume_command": f"docker exec {name} python -m delivery resume",
        "registry_instruction": "Descarga la imagen con docker pull; docker login sólo es necesario si el repositorio es privado"
        if distribution == "registry"
        else "Verifica el paquete autorizado y usa docker image load --input ARCHIVO.docker.tar",
        "notice": (
            "Laboratorio local HTTP; no utilizar esta configuración en redes no confiables. "
            if development
            else "Control remoto HTTPS. "
        )
        + "El contenedor necesita alcanzar Sentinel y los destinos de tu red. No requiere puertos entrantes. No uses localhost para servicios del host.",
    }
