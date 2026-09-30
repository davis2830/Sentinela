#!/usr/bin/env bash
# Sentinine — Sentinel Private Watchdog & LAN Probe Quick Installer
set -e

echo "====================================================="
echo "   🐕 Instalador de Agente LAN Sentinine"
echo "====================================================="

if [ -z "$SENTININE_TOKEN" ]; then
    echo "Error: Debes proporcionar la variable SENTININE_TOKEN."
    echo "Uso: SENTININE_TOKEN=\"snt_live_...\" SENTININE_SERVER=\"https://tu-sentinel.com\" bash install.sh"
    exit 1
fi

SENTININE_SERVER="${SENTININE_SERVER:-http://localhost:8000}"
INSECURE_SKIP="${SENTININE_INSECURE_SKIP_VERIFY:-false}"

if command -v docker &> /dev/null; then
    echo "[OK] Docker detectado. Desplegando contenedor Sentinine..."
    docker rm -f sentinine_agent 2>/dev/null || true
    docker run -d \
        --name sentinine_agent \
        --restart always \
        --network host \
        -e SENTININE_SERVER="$SENTININE_SERVER" \
        -e SENTININE_TOKEN="$SENTININE_TOKEN" \
        -e SENTININE_INSECURE_SKIP_VERIFY="$INSECURE_SKIP" \
        sentinel/sentinine:latest
    echo "[EXITO] Sentinine está corriendo en segundo plano."
    docker ps --filter "name=sentinine_agent"
else
    echo "[!] Docker no está instalado. Ejecutando mediante Python 3 local..."
    if ! command -v python3 &> /dev/null; then
        echo "[ERROR] Python 3 no está disponible en este sistema."
        exit 1
    fi
    export SENTININE_SERVER
    export SENTININE_TOKEN
    export SENTININE_INSECURE_SKIP_VERIFY="$INSECURE_SKIP"
    python3 agent.py
fi
