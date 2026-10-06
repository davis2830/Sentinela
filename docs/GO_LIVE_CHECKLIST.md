# Checklist de go-live

El despliegue usa una ventana breve de corte controlado.

## Antes de la ventana

- [ ] Completar secretos de `.env.production` desde [el ejemplo](../.env.production.example).
- [ ] Verificar imágenes GHCR y tag inmutable.
- [ ] Provisionar certificado y llave fuera del repositorio.
- [ ] Ejecutar suite Django, build frontend, Playwright, auditorías y Trivy.
- [ ] Validar Compose productivo, ambos builds y `nginx -t`.
- [ ] Ejecutar `quarantine_unsafe_targets` sin `--apply` y aprobar los hallazgos.
- [ ] Comunicar que los API tokens existentes deben regenerarse.
- [ ] Confirmar ventana, responsables y ruta de rollback.

## Durante la ventana

1. Crear backup PostgreSQL verificado.
2. Guardar el tag de imágenes activo.
3. Detener gateway, backend y workers.
4. Aplicar migraciones.
5. Ejecutar cuarentena con `--apply --operator <email>`.
6. Ejecutar `collectstatic` y levantar frontend, backend, workers, Nginx, Loki y Alloy.
7. Ejecutar health interno y probe HTTPS externo.

## Smoke tests

- [ ] HTTP redirige a HTTPS.
- [ ] TLS 1.2/1.3 y HSTS responden por HTTPS.
- [ ] Backend no tiene puerto de host.
- [ ] Login y dashboard.
- [ ] Alta de target por admin; Viewer recibe 403.
- [ ] Scans devuelven 202 y actualizan el timestamp.
- [ ] SSL, DNS y WHOIS ejecutan tareas registradas.
- [ ] Alloy entrega etiquetas `service`, `container`, `environment` a Loki y retoma posiciones.
- [ ] No hay `unregistered task` ni secretos en logs.

## Rollback

Restaurar el tag de imágenes anterior. Restaurar la base solo si la migración se declaró irreversible y existe un backup validado; no se restaura por defecto.
