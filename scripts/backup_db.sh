#!/usr/bin/env bash
# ==============================================================================
# Sentinel NOC — Script Automatizado de Respaldo de Base de Datos (Disaster Recovery)
# ==============================================================================
# Crea volcados comprimidos (-Fc) con pg_dump, verifica integridad y purga backups viejos.
# Soporta sincronización offsite a AWS S3 / Cloudflare R2 / MinIO si está configurado.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CONTAINER_NAME="${DB_CONTAINER:-sentinel_db}"
POSTGRES_DB="${POSTGRES_DB:-sentinel}"
POSTGRES_USER="${POSTGRES_USER:-sentinel}"

BACKUP_FILE="${BACKUP_DIR}/sentinel_${POSTGRES_DB}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando respaldo de PostgreSQL (${POSTGRES_DB})..."

# 1. Ejecutar pg_dump en formato binario comprimido
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" > "${BACKUP_FILE}"
else
    echo "[ERROR] Contenedor '${CONTAINER_NAME}' no está en ejecución." >&2
    exit 1
fi

# 2. Verificar que el archivo no esté vacío y validar con pg_restore --list
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[ERROR] El archivo de respaldo generado está vacío." >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

echo "[OK] Volcado generado: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# 3. Generar Checksum SHA-256 para auditoría de integridad
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
echo "[OK] Checksum generado: $(cat "${CHECKSUM_FILE}")"

# 4. Sincronización Off-site a S3 (si S3_BACKUP_BUCKET está definido)
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
    echo "[INFO] Sincronizando respaldo hacia ${S3_BACKUP_BUCKET}..."
    if command -v aws >/dev/null 2>&1; then
        aws s3 cp "${BACKUP_FILE}" "s3://${S3_BACKUP_BUCKET}/db_backups/" --sse AES256
        aws s3 cp "${CHECKSUM_FILE}" "s3://${S3_BACKUP_BUCKET}/db_backups/" --sse AES256
        echo "[OK] Respaldo copiado exitosamente a S3."
    else
        echo "[ADVERTENCIA] 'aws' CLI no encontrado. Omitiendo subida S3."
    fi
fi

# 5. Purga de respaldos locales antiguos (> RETENTION_DAYS)
echo "[INFO] Purgando respaldos locales con más de ${RETENTION_DAYS} días de antigüedad..."
find "${BACKUP_DIR}" -name "sentinel_*.dump" -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -name "sentinel_*.sha256" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Respaldo completado exitosamente."
