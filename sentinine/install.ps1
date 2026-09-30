# Sentinine — Sentinel Private Watchdog & LAN Probe Quick Installer (Windows PowerShell)
param (
    [Parameter(Mandatory=$true)]
    [string]$Token,
    [string]$Server = "http://localhost:8000",
    [switch]$InsecureSkipVerify
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   🐕 Instalador de Agente LAN Sentinine (Windows)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$insecureVal = if ($InsecureSkipVerify) { "true" } else { "false" }

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Docker detectado. Desplegando contenedor Sentinine..." -ForegroundColor Green
    docker rm -f sentinine_agent 2>$null
    docker run -d `
        --name sentinine_agent `
        --restart always `
        -e SENTININE_SERVER="$Server" `
        -e SENTININE_TOKEN="$Token" `
        -e SENTININE_INSECURE_SKIP_VERIFY="$insecureVal" `
        sentinel/sentinine:latest
    Write-Host "[EXITO] Contenedor Sentinine iniciado exitosamente." -ForegroundColor Green
    docker ps --filter "name=sentinine_agent"
} else {
    Write-Host "[!] Docker no está instalado. Ejecutando mediante Python local..." -ForegroundColor Yellow
    $env:SENTININE_SERVER = $Server
    $env:SENTININE_TOKEN = $Token
    $env:SENTININE_INSECURE_SKIP_VERIFY = $insecureVal
    python agent.py
}
