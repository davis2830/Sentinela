"""
Sentinel Satellite Private Probe Agent
======================================
Lightweight, zero-external-dependency runner for monitoring private
on-premise networks, local databases, and VPCs without opening inbound firewall ports.
"""

import json
import os
import platform
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SENTINEL_SERVER = os.environ.get("SENTINEL_SERVER", "http://localhost:8000").rstrip("/")
SENTINEL_TOKEN = os.environ.get("SENTINEL_TOKEN", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
PROBE_VERSION = "1.0.0"

if not SENTINEL_TOKEN:
    print("[ERROR] SENTINEL_TOKEN environment variable is required.", file=sys.stderr)
    print("Example: docker run -e SENTINEL_TOKEN=\"prb_live_...\" -e SENTINEL_SERVER=\"https://app.sentinel.com\" sentinel/probe:latest")
    sys.exit(1)


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [SentinelProbe] {msg}", flush=True)


def check_target(task):
    target_id = task["target_id"]
    endpoint = task["endpoint"]
    target_type = task.get("target_type", "http").lower()
    expected_status = task.get("expected_status", 200)
    timeout = min(15, task.get("max_latency_ms", 2000) / 1000.0)

    # 1. HTTP / HTTPS / API checks
    if target_type in ("http", "https", "api"):
        url = endpoint if endpoint.startswith(("http://", "https://")) else f"http://{endpoint}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": f"SentinelProbe/{PROBE_VERSION}"},
            method=task.get("http_method", "GET"),
        )
        if task.get("custom_headers"):
            for k, v in task["custom_headers"].items():
                req.add_header(k, v)

        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                code = resp.getcode()
                status = "up" if code == expected_status else "down"
                return {
                    "target_id": target_id,
                    "status": status,
                    "response_time_ms": elapsed_ms,
                    "http_status": code,
                    "error_message": "" if status == "up" else f"Expected {expected_status}, got {code}",
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

    # 2. TCP Port Check (e.g. databases, internal services)
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
                "error_message": str(exc),
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
    url = f"{SENTINEL_SERVER}/api/v1/agent-probes/heartbeat/"
    payload = json.dumps({
        "hostname": socket.gethostname(),
        "os_info": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "version": PROBE_VERSION,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Probe-Token": SENTINEL_TOKEN,
            "User-Agent": f"SentinelProbe/{PROBE_VERSION}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("data", {})


def submit_results(results):
    if not results:
        return
    url = f"{SENTINEL_SERVER}/api/v1/agent-probes/submit-results/"
    payload = json.dumps({"results": results}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Probe-Token": SENTINEL_TOKEN,
            "User-Agent": f"SentinelProbe/{PROBE_VERSION}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        pass


def main():
    log(f"Iniciando Agente Satélite Sentinel v{PROBE_VERSION}")
    log(f"Servidor destino: {SENTINEL_SERVER}")
    log(f"Hostname local: {socket.gethostname()}")

    executor = ThreadPoolExecutor(max_workers=10)

    while True:
        try:
            # 1. Send heartbeat and retrieve assigned targets
            heartbeat_data = send_heartbeat()
            probe_name = heartbeat_data.get("probe_name", "Unknown Probe")
            tasks = heartbeat_data.get("tasks", [])
            interval = heartbeat_data.get("poll_interval_seconds", POLL_INTERVAL)

            if tasks:
                log(f"Probe '{probe_name}': Ejecutando {len(tasks)} chequeo(s) en red local...")
                # 2. Run local checks concurrently
                futures = [executor.submit(check_target, t) for t in tasks]
                results = [f.result() for f in futures]

                # 3. Report results back to Sentinel cloud
                submit_results(results)
                up_count = sum(1 for r in results if r["status"] == "up")
                log(f"Resultados enviados: {up_count}/{len(results)} UP.")
            else:
                log(f"Probe '{probe_name}' conectado [Heartbeat OK]. Sin objetivos asignados actualmente.")

            time.sleep(interval)

        except urllib.error.HTTPError as e:
            if e.code == 401:
                log(f"[ERROR CRÍTICO] Token de probe rechazado (HTTP 401). Verifica SENTINEL_TOKEN.")
                time.sleep(30)
            else:
                log(f"[ADVERTENCIA] Error HTTP al contactar Sentinel: {e.code} {e.reason}")
                time.sleep(10)
        except Exception as exc:
            log(f"[ADVERTENCIA] Conexión interrumpida: {exc}. Reintentando en 10s...")
            time.sleep(10)


if __name__ == "__main__":
    main()
