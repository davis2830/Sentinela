#!/usr/bin/env bash
# ==============================================================================
# Sentinel NOC — Script de Restauración de Base de Datos (Disaster Recovery)
# ==============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Uso: $0 <ruta_al_archivo_dump>"
    echo "Ejemplo: $0 /backups/sentinel_sentinel_20261001_030000.dump"
    exit 1
fi

DUMP_FILE="$1"
CONTAINER_NAME="${DB_CONTAINER:-sentinel_db}"
POSTGRES_DB="${POSTGRES_DB:-sentinel}"
POSTGRES_USER="${POSTGRES_USER:-sentinel}"

if [ ! -f "${DUMP_FILE}" ]; then
    echo "[ERROR] El archivo de respaldo '${DUMP_FILE}' no existe." >&2
    exit 1
fi

# Validar integridad del dump antes de tocar la base de datos
echo "[INFO] Validando integridad del archivo dump..."
docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${DUMP_FILE}" >/dev/null

echo "=============================================================================="
echo "⚠️  ADVERTENCIA DE SEGURIDAD CRÍTICA ⚠️"
echo "Esta operación RESTAURARÁ la base de datos '${POSTGRES_DB}' en el contenedor '${CONTAINER_NAME}'."
echo "Archivo origen: ${DUMP_FILE}"
echo "=============================================================================="
read -p "¿Estás 100% seguro de proceder con la restauración? (escribe 'RESTAURAR'): " CONFIRM

if [ "${CONFIRM}" != "RESTAURAR" ]; then
    echo "Operación cancelada por el usuario."
    exit 0
fi

echo "[INFO] Cerrando conexiones activas a la base de datos '${POSTGRES_DB}'..."
docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();"

echo "[INFO] Restaurando datos..."
docker exec -i "${CONTAINER_NAME}" pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists < "${DUMP_FILE}"

echo "[OK] Restauración completada exitosamente."
