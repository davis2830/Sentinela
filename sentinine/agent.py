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
from common.safe_http import open_request
from common.network import parse_endpoint, dns_host, resolve_addresses, connect_bounded, resolution_timeout, validate_target_addresses
from delivery import Journal, DeliveryRuntime
from security import load_token, validate_server_url, tls_context, control_request, development
from pathlib import Path
import hashlib
import signal

SENTININE_SERVER = os.environ.get(
    "SENTININE_SERVER",
    os.environ.get("SENTINEL_SERVER", "https://sentinel.gctechops.com")
).rstrip("/")

SENTININE_TOKEN = load_token()

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
INSECURE_SKIP_VERIFY = os.environ.get(
    "SENTININE_INSECURE_SKIP_VERIFY",
    os.environ.get("INSECURE_SKIP_VERIFY", "false")
).lower() in ("true", "1", "yes")

AGENT_VERSION = "1.7.0"
CHECK_TIMEOUT_SECONDS = float(os.environ.get('SENTININE_CHECK_TIMEOUT_SECONDS', '15'))
if not 0 < CHECK_TIMEOUT_SECONDS <= 120:
    raise ValueError('SENTININE_CHECK_TIMEOUT_SECONDS debe estar entre 0 y 120.')

if not SENTININE_TOKEN:
    print("[ERROR] SENTININE_TOKEN (o SENTINEL_TOKEN) es requerido como variable de entorno.", file=sys.stderr)
    print("Ejemplo: docker run -e SENTININE_TOKEN=\"snt_live_...\" -e SENTININE_SERVER=\"https://app.sentinel.com\" sentinel/sentinine:latest")
    sys.exit(1)


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [Senti9] {msg}", flush=True)


def get_ssl_context(insecure_override=None):
    skip = INSECURE_SKIP_VERIFY if insecure_override is None else insecure_override
    return tls_context(insecure=bool(skip))


def check_target(task):
    try:
        result = _execute_target(task)
    except Exception:
        # A malformed task must not discard other targets in the batch.
        result = {'target_id': task.get('target_id'), 'status': 'error',
                  'response_time_ms': 0.0, 'http_status': 0,
                  'error_message': 'Configuración de comprobación no válida.'}
    limit = task.get("max_latency_ms", 2000)
    result["evaluation_policy"] = {"max_latency_ms": limit, "expected_status": task.get("expected_status", 200)}
    if result["status"] in ("up", "slow"):
        result["status"] = "slow" if result["response_time_ms"] > limit else "up"
    return result


def _execute_target(task):
    target_id = task["target_id"]
    endpoint = task["endpoint"]
    target_type = task.get("target_type", "http").lower()
    expected_status = task.get("expected_status", 200)
    timeout = CHECK_TIMEOUT_SECONDS
    skip_ssl = task.get("insecure_skip_verify", INSECURE_SKIP_VERIFY)

    # 1. HTTP / HTTPS / API Checks
    if target_type in ("http", "https", "api"):
        scheme = 'https' if target_type == 'https' else 'http'
        url = endpoint if endpoint.startswith(("http://", "https://")) else f"{scheme}://{endpoint}"
        body = task.get('request_body', '')
        if not isinstance(body, str):
            raise ValueError('request_body debe ser texto.')
        if len(body.encode('utf-8')) > 1024 * 1024:
            raise ValueError('request_body supera 1 MiB.')
        req = urllib.request.Request(
            url,
            data=body.encode('utf-8') if body else None,
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
            with open_request(req, timeout=timeout, context=ctx, target=True) as resp:
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
            e.close()
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
        host, port, _ = parse_endpoint(endpoint)
        start = time.perf_counter()
        try:
            with connect_bounded(host, port, timeout, target=True):
                pass
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
                "error_message": 'TimeoutError' if isinstance(exc,TimeoutError) else 'gaierror' if isinstance(exc,socket.gaierror) else 'ConnectionRefusedError' if isinstance(exc,ConnectionRefusedError) else 'ConnectionError',
            }

    # 3. DNS Resolution Check (Servidores DNS internos / Active Directory)
    elif target_type == "dns":
        start = time.perf_counter()
        try:
            host = dns_host(endpoint)
        except ValueError as exc:
            return {'target_id':target_id,'status':'error','response_time_ms':0,'http_status':0,
                    'error_message':str(exc)}
        try:
            addresses = resolve_addresses(host, 0, min(timeout, resolution_timeout()))
            validate_target_addresses(addresses)
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
                "error_message": 'TimeoutError' if isinstance(exc,TimeoutError) else 'gaierror' if isinstance(exc,socket.gaierror) else 'ConnectionError',
            }

    # Default fallback
    return {
        "target_id": target_id,
        "status": "error",
        "response_time_ms": 0.0,
        "http_status": 0,
        "error_message": f"Protocolo no soportado por Senti9: {target_type}",
    }


def send_heartbeat(capacity=10, known_executions=(), telemetry=None):
    url = f"{SENTININE_SERVER}/api/v1/agent-probes/heartbeat/"
    payload = json.dumps({
        "hostname": socket.gethostname(),
        "os_info": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "version": AGENT_VERSION,
        "agent_name": "Senti9",
        "delivery_protocol": 2,
        "capacity": capacity,
        "known_executions": list(known_executions),
        "telemetry": telemetry,
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

    with control_request(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("data", {})


def submit_results(results):
    if not results:
        return
    url = f"{SENTININE_SERVER}/api/v1/agent-probes/submit-results/"
    payload = json.dumps({"delivery_protocol": 2, "results": results}).encode("utf-8")

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

    with control_request(req, timeout=10) as resp:
        return json.loads(resp.read(1024*1024).decode('utf-8')).get('data', {})


def main():
    resolution_timeout()
    validate_server_url(SENTININE_SERVER)
    if INSECURE_SKIP_VERIFY and not development():
        raise ValueError('Bypass TLS no permitido en producción.')
    log(f"Iniciando Senti9 — Agente privado de Sentinel v{AGENT_VERSION}")
    log(f"Servidor Sentinel de destino: {SENTININE_SERVER}")
    log(f"Hostname local: {socket.gethostname()}")
    if INSECURE_SKIP_VERIFY:
        log("Aviso: SENTININE_INSECURE_SKIP_VERIFY activado (Bypass de validación SSL para CAs autofirmadas).")

    state_dir = Path(os.environ.get('SENTININE_STATE_DIR', str(Path.home()/'.local'/'state'/'senti9')))
    # Never deliver an old installation's journal to a different server/token.
    scope = hashlib.sha256((SENTININE_SERVER+'\0'+SENTININE_TOKEN).encode()).hexdigest()[:24]
    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state_dir/f'{scope}.lock').open('a+b') as lock:
        if os.name == 'nt':
            import msvcrt
            lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        journal = Journal(state_dir/f'{scope}.sqlite3')
        runtime = DeliveryRuntime(journal, check_target, send_heartbeat, submit_results, log,
                                  draining=lambda: (state_dir/'drain').exists())
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: runtime.stop.set())
        runtime.start()
        try:
            while not runtime.stop.wait(1):
                pass
        finally:
            runtime.close()


if __name__ == "__main__":
    main()
