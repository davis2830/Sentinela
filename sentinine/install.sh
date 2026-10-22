#!/usr/bin/env bash
# Senti9 installer. Never replaces an existing container implicitly.
set -euo pipefail
SENTININE_SERVER="${SENTININE_SERVER:-https://sentinel.gctechops.com}"
SENTININE_IMAGE="${SENTININE_IMAGE:-davis1924/senti9:1.7.0}"
if [[ -z "${SENTININE_TOKEN_FILE:-}" && -z "${SENTININE_TOKEN:-}" ]]; then
    echo 'Define SENTININE_TOKEN_FILE (recomendado) o SENTININE_TOKEN.' >&2
    exit 1
fi
if command -v docker >/dev/null; then
    if docker container inspect sentinine_agent >/dev/null 2>&1; then
        echo 'El contenedor ya existe. Actualizar conservando el volumen.' >&2
        exit 1
    fi
    args=(run -d --name sentinine_agent --restart unless-stopped
        --user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges:true
        --pids-limit 128 --memory 256m --cpus 1
        --tmpfs /tmp:rw,noexec,nosuid,size=16m,mode=1777
        --mount source=sentinine_state,target=/data --network host
        -e SENTININE_SERVER -e SENTININE_ENV -e SENTININE_ALLOW_HTTP)
    export SENTININE_SERVER SENTININE_ENV="${SENTININE_ENV:-production}" SENTININE_ALLOW_HTTP="${SENTININE_ALLOW_HTTP:-false}"
    if [[ -n "${SENTININE_TOKEN_FILE:-}" ]]; then
        [[ -f "$SENTININE_TOKEN_FILE" ]] || { echo 'Archivo de token no encontrado.' >&2; exit 1; }
        token_dir="$(cd -- "$(dirname -- "$SENTININE_TOKEN_FILE")" && pwd)"
        args+=(--mount "type=bind,source=$token_dir/$(basename -- "$SENTININE_TOKEN_FILE"),target=/run/secrets/sentinine_token,readonly"
            -e SENTININE_TOKEN_FILE=/run/secrets/sentinine_token)
    else
        export SENTININE_TOKEN
        args+=(-e SENTININE_TOKEN)
    fi
    for ca_var in SENTININE_CONTROL_CA_FILE SENTININE_TARGET_CA_FILE; do
        ca_source="${!ca_var:-}"
        if [[ -n "$ca_source" ]]; then
            [[ -f "$ca_source" ]] || { echo 'Archivo CA no encontrado.' >&2; exit 1; }
            ca_dir="$(cd -- "$(dirname -- "$ca_source")" && pwd)"
            ca_destination="/run/certs/$ca_var.pem"
            args+=(--mount "type=bind,source=$ca_dir/$(basename -- "$ca_source"),target=$ca_destination,readonly" -e "$ca_var=$ca_destination")
        fi
    done
    docker "${args[@]}" "$SENTININE_IMAGE"
    echo 'Contenedor creado. Verificar logs y heartbeat; el inicio no confirma conectividad.'
else
    export SENTININE_SERVER
    exec python3 "$(dirname -- "$0")/agent.py"
fi
