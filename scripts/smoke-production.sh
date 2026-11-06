#!/usr/bin/env bash
# Only the disposable production-shaped audit stack; never the actual deployment.
set -Eeuo pipefail
project="${1:-sentinel-prod-ci}"
case "$project" in
  sentinel-prod-ci|sentinel-prod-audit-*) ;;
  *) echo 'Refusing to operate on a non-audit project.' >&2; exit 2 ;;
esac
compose=(docker compose --env-file .env.production.example -p "$project" -f docker-compose.prod.yml -f docker-compose.audit.prod.yml)
cert=.tmp/audit-tls/tls.crt
origin=https://localhost:31843

for attempt in {1..30}; do
  if curl --fail --silent --cacert "$cert" "$origin/health/" > /dev/null; then break; fi
  if [ "$attempt" = 30 ]; then echo 'Readiness did not become healthy.' >&2; exit 1; fi
  sleep 2
done
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://localhost:31880/)" = 301
curl --fail --silent --cacert "$cert" "$origin/" > /dev/null
curl --fail --silent --tlsv1.2 --tls-max 1.2 --cacert "$cert" "$origin/health/" > /dev/null
curl --fail --silent --tlsv1.3 --cacert "$cert" "$origin/health/" > /dev/null
curl --fail --silent --cacert "$cert" -D - "$origin/health/" | grep -qi '^strict-transport-security:'
test "$(curl --silent --cacert "$cert" --output /dev/null --write-out '%{http_code}' "$origin/api/v1/auth/me/")" = 401
backend_id="$("${compose[@]}" ps -q backend)"
test -n "$backend_id"
test -z "$(docker inspect -f '{{range .NetworkSettings.Ports}}{{range .}}{{.HostPort}}{{end}}{{end}}' "$backend_id")"
"${compose[@]}" exec -T backend python -c "import os; assert os.getuid() == 10001"

# Readiness must reflect an unavailable worker. No Beat is running in this stack.
"${compose[@]}" stop celery_worker
for attempt in {1..15}; do
  code="$(curl --silent --cacert "$cert" --output /dev/null --write-out '%{http_code}' "$origin/health/")"
  if [ "$code" = 503 ]; then break; fi
  if [ "$attempt" = 15 ]; then echo 'Worker loss was not reflected in readiness.' >&2; exit 1; fi
  sleep 2
done
"${compose[@]}" up -d celery_worker
for attempt in {1..30}; do
  if curl --fail --silent --cacert "$cert" "$origin/health/" > /dev/null; then
    echo 'Production-shaped smoke passed: TLS, HSTS, redirect, routing, non-root, private backend and worker recovery.'
    exit 0
  fi
  sleep 2
done
echo 'Worker recovery was not reflected in readiness.' >&2
exit 1
