<#
.SYNOPSIS
    Sentinel NOC — Script de Respaldo Automatizado en PowerShell (Windows)
.DESCRIPTION
    Genera un dump binario comprimido (-Fc) de PostgreSQL con Docker,
    calcula el hash SHA256 y purga volcados antiguos.
#>

param(
    [string]$ContainerName = "sentinel_db",
    [string]$DbUser = "sentinel",
    [string]$DbName = "sentinel",
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFileName = "sentinel_${DbName}_${timestamp}.dump"
$dumpFilePath = Join-Path $BackupDir $dumpFileName
$checksumFilePath = "$dumpFilePath.sha256"

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Generando respaldo de PostgreSQL ($DbName)..." -ForegroundColor Cyan

# Ejecutar pg_dump dentro del contenedor Docker
$cmd = "docker exec $ContainerName pg_dump -U $DbUser -Fc $DbName"
Invoke-Expression "$cmd > `"$dumpFilePath`""

if (-not (Test-Path $dumpFilePath) -or (Get-Item $dumpFilePath).Length -eq 0) {
    Write-Error "El archivo de respaldo no se generó correctamente o está vacío."
    exit 1
}

$fileSizeMb = [math]::Round(((Get-Item $dumpFilePath).Length / 1MB), 2)
Write-Host "[OK] Respaldo generado con éxito: $dumpFilePath ($fileSizeMb MB)" -ForegroundColor Green

# Generar hash SHA256
$hash = (Get-FileHash -Path $dumpFilePath -Algorithm SHA256).Hash
Set-Content -Path $checksumFilePath -Value $hash
Write-Host "[OK] Checksum SHA256: $hash" -ForegroundColor Green

# Purgar backups de más de N días
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "sentinel_*.dump" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item -Force
Get-ChildItem -Path $BackupDir -Filter "sentinel_*.sha256" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item -Force

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Proceso de respaldo completado." -ForegroundColor Cyan
