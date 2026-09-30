"""
Sentinine — Sentinel Private Watchdog & LAN Probe Agent
======================================================
Lightweight, zero-external-dependency runner for monitoring private
on-premise networks, local databases, and VPCs without opening inbound firewall ports.
"""

import json
import os
import platform
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SENTININE_SERVER = os.environ.get(
    "SENTININE_SERVER",
    os.environ.get("SENTINEL_SERVER", "http://localhost:8000")
).rstrip("/")

SENTININE_TOKEN = os.environ.get(
    "SENTININE_TOKEN",
    os.environ.get("SENTINEL_TOKEN", "")
)

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
INSECURE_SKIP_VERIFY = os.environ.get(
    "SENTININE_INSECURE_SKIP_VERIFY",
    os.environ.get("INSECURE_SKIP_VERIFY", "false")
).lower() in ("true", "1", "yes")

AGENT_VERSION = "1.1.0"

if not SENTININE_TOKEN:
    print("[ERROR] SENTININE_TOKEN (o SENTINEL_TOKEN) es requerido como variable de entorno.", file=sys.stderr)
    print("Ejemplo: docker run -e SENTININE_TOKEN=\"snt_live_...\" -e SENTININE_SERVER=\"https://app.sentinel.com\" sentinel/sentinine:latest")
    sys.exit(1)


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [Sentinine] {msg}", flush=True)


def get_ssl_context(insecure_override=None):
    skip = INSECURE_SKIP_VERIFY if insecure_override is None else insecure_override
    if skip:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context()


def check_target(task):
    target_id = task["target_id"]
    endpoint = task["endpoint"]
    target_type = task.get("target_type", "http").lower()
    expected_status = task.get("expected_status", 200)
    timeout = min(15, max(1, task.get("max_latency_ms", 2000) / 1000.0))
    skip_ssl = task.get("insecure_skip_verify", INSECURE_SKIP_VERIFY)

    # 1. HTTP / HTTPS / API Checks
    if target_type in ("http", "https", "api"):
        url = endpoint if endpoint.startswith(("http://", "https://")) else f"http://{endpoint}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": f"Sentinine/{AGENT_VERSION} (Sentinel LAN Watchdog)",
                "Accept": "*/*",
            },
            method=task.get("http_method", "GET"),
        )
        if task.get("custom_headers"):
            for k, v in task["custom_headers"].items():
                req.add_header(k, str(v))

        ctx = get_ssl_context(skip_ssl) if url.startswith("https://") else None
        start = time.perf_counter()

        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                code = resp.getcode()
                status = "up" if code == expected_status else "down"
                return {
                    "target_id": target_id,
                    "status": status,
                    "response_time_ms": elapsed_ms,
                    "http_status": code,
                    "error_message": "" if status == "up" else f"Esperado HTTP {expected_status}, obtenido {code}",
                }
        except urllib.error.HTTPError as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            status = "up" if e.code == expected_status else "down"
            return {
                "target_id": target_id,
                "status": status,
                "response_time_ms": elapsed_ms,
                "http_status": e.code,
                "error_message": "" if status == "up" else f"HTTP {e.code}: {e.reason}",
            }
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "target_id": target_id,
                "status": "down",
                "response_time_ms": elapsed_ms,
                "http_status": 0,
                "error_message": str(exc),
            }

    # 2. TCP Port Check (Bases de datos, SSH, SAP, Redis, puertos locales)
    elif target_type == "tcp":
        host = endpoint
        port = 80
        if ":" in endpoint:
            parts = endpoint.split(":")
            host = parts[0]
            try:
                port = int(parts[1])
            except ValueError:
                port = 80

        start = time.perf_counter()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            sock.connect((host, port))
            sock.close()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "target_id": target_id,
                "status": "up",
                "response_time_ms": elapsed_ms,
                "http_status": 0,
                "error_message": "",
            }
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "target_id": target_id,
                "status": "down",
                "response_time_ms": elapsed_ms,
                "http_status": 0,
                "error_message": f"Fallo de conexión TCP ({host}:{port}): {exc}",
            }

    # 3. DNS Resolution Check (Servidores DNS internos / Active Directory)
    elif target_type == "dns":
        start = time.perf_counter()
        host = endpoint.split(":")[0].strip()
        try:
            ip = socket.gethostbyname(host)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "target_id": target_id,
                "status": "up",
                "response_time_ms": elapsed_ms,
                "http_status": 0,
                "error_message": "",
            }
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "target_id": target_id,
                "status": "down",
                "response_time_ms": elapsed_ms,
                "http_status": 0,
                "error_message": f"Error de resolución DNS ({host}): {exc}",
            }

    # Default fallback
    return {
        "target_id": target_id,
        "status": "up",
        "response_time_ms": 1.0,
        "http_status": 200,
        "error_message": "",
    }


def send_heartbeat():
    url = f"{SENTININE_SERVER}/api/v1/agent-probes/heartbeat/"
    payload = json.dumps({
        "hostname": socket.gethostname(),
        "os_info": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "version": AGENT_VERSION,
        "agent_name": "Sentinine",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Probe-Token": SENTININE_TOKEN,
            "User-Agent": f"Sentinine/{AGENT_VERSION}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("data", {})


def submit_results(results):
    if not results:
        return
    url = f"{SENTININE_SERVER}/api/v1/agent-probes/submit-results/"
    payload = json.dumps({"results": results}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Probe-Token": SENTININE_TOKEN,
            "User-Agent": f"Sentinine/{AGENT_VERSION}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        pass


def main():
    log(f"Iniciando Guardián de Red LAN Sentinine v{AGENT_VERSION}")
    log(f"Servidor Sentinel de destino: {SENTININE_SERVER}")
    log(f"Hostname local: {socket.gethostname()}")
    if INSECURE_SKIP_VERIFY:
        log("Aviso: SENTININE_INSECURE_SKIP_VERIFY activado (Bypass de validación SSL para CAs autofirmadas).")

    executor = ThreadPoolExecutor(max_workers=10)
    consecutive_errors = 0

    while True:
        try:
            # 1. Enviar heartbeat y obtener lista de objetivos asignados
            heartbeat_data = send_heartbeat()
            consecutive_errors = 0
            probe_name = heartbeat_data.get("probe_name", "Sentinine Guardián")
            tasks = heartbeat_data.get("tasks", [])
            interval = heartbeat_data.get("poll_interval_seconds", POLL_INTERVAL)

            if tasks:
                log(f"'{probe_name}': Ejecutando {len(tasks)} chequeo(s) en red interna...")
                # 2. Ejecutar chequeos concurrentes
                futures = [executor.submit(check_target, t) for t in tasks]
                results = [f.result() for f in futures]

                # 3. Reportar resultados a Sentinel
                submit_results(results)
                up_count = sum(1 for r in results if r["status"] == "up")
                log(f"Resultados reportados: {up_count}/{len(results)} UP.")
            else:
                log(f"'{probe_name}' conectado [Heartbeat OK]. Sin objetivos asignados.")

            time.sleep(interval)

        except urllib.error.HTTPError as e:
            consecutive_errors += 1
            if e.code == 401:
                log(f"[ERROR CRÍTICO] Token de Sentinine rechazado (HTTP 401). Verifica SENTININE_TOKEN.")
                time.sleep(30)
            else:
                log(f"[ADVERTENCIA] Error HTTP al contactar Sentinel: {e.code} {e.reason}")
                time.sleep(min(30, 5 * consecutive_errors))
        except Exception as exc:
            consecutive_errors += 1
            log(f"[ADVERTENCIA] Error de comunicación ({exc}). Reintentando...")
            time.sleep(min(30, 5 * consecutive_errors))


if __name__ == "__main__":
    main()
