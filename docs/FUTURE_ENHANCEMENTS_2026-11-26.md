# Sentinel NOC — Mejoras a Futuro y Diferenciadores de Producto (2026-11-26)

## Visión y ventaja competitiva actual

Las herramientas tradicionales de uptime (UptimeRobot, Uptime Kuma, Pingdom) compiten principalmente en hacer ping HTTP cada minuto. **Sentinel** ya cuenta en una sola plataforma multi-tenant con correlación transversal entre capas:

- `monitoring` (Uptime HTTP/HTTPS/TCP/DNS/SSL) + `TargetCoverage`
- `api_checks` (validación de APIs y contratos)
- `ssl_monitor`, `dns_monitor`, `domain`, `security_headers`
- `sentinine` (**Senti9** — agente privado on-premise/híbrido)
- `incidents`, `alerts`, `maintenance`, `notifications`, `reports`, `status_page`, `organizations`, `teams`, `audit`

El objetivo de estas 12 iniciativas es convertir esa base técnica en capacidades por las que equipos de TI, PyMEs, áreas de ciberseguridad y MSPs/agencias prefieran Sentinel frente a monitores simples.

---

## Matriz de Priorización (Impacto vs. Esfuerzo)

| Horizonte | Iniciativas | Enfoque |
|---|---|---|
| **Corto plazo (Quick Wins)** | #1 Correlación de causa raíz, #2 Heartbeat / Dead Man's Switch, #5 Guardia de cambios silenciosos, #8 Deploy Markers | Alto valor inmediato reutilizando modelos y datos existentes |
| **Mediano plazo (Diferenciación)** | #4 Reportes ejecutivos SLA, #6 Flujos sintéticos encadenados, #7 Anti-fatiga + On-Call + WhatsApp/Telegram, #9 Baseline de latencia, #12 Postmortem + Suscripciones | Retención de clientes, reducción de ruido y flujos completos |
| **Largo plazo (Expansión B2B)** | #3 Senti9 híbrido avanzado, #10 Reputación de correo / RBL, #11 Modo MSP / Partner | Nuevos segmentos de mercado (infraestructura interna, compliance, agencias) |

---

## Catálogo de 12 Mejoras a Futuro

### 1. Diagnóstico automático de causa raíz (Correlación entre capas)
- **Brecha de mercado:** Los monitores tradicionales disparan múltiples alertas aisladas cuando algo cae y obligan al ingeniero a investigar manualmente qué capa falló primero.
- **Módulos involucrados:** `monitoring` (`TargetCoverage`), `dns_monitor`, `ssl_monitor`, `domain`, `incidents`, `sentinine`.
- **Alcance:**
  - Al abrir un incidente sobre un `MonitoringTarget`, cruzar automáticamente eventos recientes de sus recursos vinculados: cambios DNS recientes, expiración/cambio de nameservers del dominio, fallos TLS o discrepancia entre ejecución `cloud` y `Senti9` (red interna viva vs. caída externa).
  - Mostrar un bloque de **"Causa probable"** en el detalle del incidente y en la notificación.

### 2. Monitoreo de Jobs, Cron y Backups (*Heartbeat / Dead Man's Switch*)
- **Brecha de mercado:** Un sitio puede seguir devolviendo `HTTP 200`, mientras el backup nocturno, la facturación o un cron crítico lleva días sin ejecutarse.
- **Módulos involucrados:** `monitoring`, `incidents`, `alerts`, `maintenance`.
- **Alcance:**
  - Endpoint ligero (`POST /api/v1/heartbeat/<token>/`) con ventana esperada e intervalo de gracia.
  - Apertura automática de incidente cuando no se recibe señal dentro de la ventana configurada.

### 3. Monitoreo híbrido sin abrir puertos (Senti9 como diferenciador B2B)
- **Brecha de mercado:** Los SaaS puros no alcanzan ERPs internos, bases de datos, impresoras fiscales o APIs detrás de VPN sin exponer puertos; las soluciones self-hosted exigen administrar servidores adicionales.
- **Módulos involucrados:** `sentinine` (Senti9), `monitoring`, `organizations`.
- **Alcance:**
  - Consolidar el monitoreo de sucursales/on-premise y nube en un solo panel usando Senti9 (contenedor ligero, sin privilegios y con journal local).
  - Añadir métricas de salud de enlace interno (latencia/pérdida de paquetes, estado de red local) reportadas en el heartbeat.

### 4. Reportes ejecutivos y de SLA listos para entregar
- **Brecha de mercado:** Las plataformas de monitoreo muestran gráficas en vivo, pero obligan a tomar capturas manuales para reportar resultados a gerencia o clientes finales.
- **Módulos involucrados:** `reports`, `organizations` (`sla_target_percentage`), `monitoring`, `incidents`, `ssl_monitor`, `domain`.
- **Alcance:**
  - Generación automática mensual/semanal (PDF y resumen por correo) con marca blanca/organización: uptime real vs. SLA objetivo, incidentes, MTTR, certificados/dominios próximos a vencer y cambios de seguridad detectados.

### 5. "Guardia de cambios silenciosos" (Postura y cumplimiento continuo)
- **Brecha de mercado:** Cambios no autorizados o silenciosos en producción (eliminación de `HSTS`/`CSP`, alteración de `SPF`/`DMARC`, rotación inesperada de IPs) pasan desapercibidos hasta causar incidentes o fallos de seguridad.
- **Módulos involucrados:** `security_headers`, `dns_monitor`, `domain`, `alerts`.
- **Alcance:**
  - Alertas específicas por degradación de postura (headers debilitados, cambios en registros críticos `MX`/`TXT`/`NS`, desactivación de auto-renew o cambios de estado EPP).

### 6. Flujos sintéticos encadenados (*User Journeys*)
- **Brecha de mercado:** Validar solo `GET /health` no detecta fallos en login, emisión de JWT o flujos de negocio; las plataformas que soportan multi-step suelen cobrar tarifas enterprise.
- **Módulos involucrados:** `api_checks`, `monitoring`.
- **Alcance:**
  - Permitir pasos secuenciales dentro de un mismo check (ej. `POST /login` → extraer token/variable → `GET /resource` → validar JSONPath, código y latencia acumulada).

### 7. Anti-fatiga de alertas, escalación On-Call y canales reales (WhatsApp / Telegram)
- **Brecha de mercado:** El correo falla para incidentes críticos nocturnos y la falta de dependencias genera tormentas de alertas cuando cae un nodo padre.
- **Módulos involucrados:** `alerts`, `notifications`, `incidents`, `teams`, `monitoring`.
- **Alcance:**
  - **Dependencias padre → hijo:** silenciar alertas hijas cuando el enlace/host raíz está caído y consolidar en un incidente raíz.
  - **Rotación On-Call y escalación:** notificar por Telegram/WhatsApp al técnico de turno y escalar al líder del equipo si no hay `Ack` en $N$ minutos.
  - **Acciones rápidas en mensaje:** botones/enlaces firmados para `Acknowledge` o `Silenciar 30 min` directo desde la notificación.

### 8. Marcadores de despliegue (*Deploy Markers*)
- **Brecha de mercado:** Correlacionar una subida de latencia o tasa de error con un despliegue reciente suele requerir revisar logs de CI por separado.
- **Módulos involucrados:** `monitoring`, `api_checks`, `incidents`, `accounts` (`APIToken`).
- **Alcance:**
  - Webhook autenticado (`POST /api/v1/deployments/`) consumible desde `cd.yml` o cualquier pipeline externo.
  - Marcadores verticales en las series de tiempo y correlación automática en incidentes abiertos dentro de los minutos posteriores a un deploy.

### 9. Detección de anomalías y degradación temprana (Baseline de latencia)
- **Brecha de mercado:** Los umbrales estáticos (ej. `> 2000 ms`) no detectan cuando un servicio que normalmente responde en `80 ms` pasa a `900 ms` por saturación o fuga de memoria.
- **Módulos involucrados:** `monitoring`, `api_checks`, `alerts`.
- **Alcance:**
  - Cálculo de baseline móvil (promedio/p95 reciente) por target y alertas por desviación sostenida antes de llegar a timeout o caída total.

### 10. Vigilancia de reputación de correo y Blacklists (RBL + SPF/DKIM/DMARC)
- **Brecha de mercado:** Para empresas con facturación electrónica o correo transaccional, caer en listas negras (RBL) o romper `SPF`/`DMARC` tiene impacto operativo directo y no lo cubren los monitores de uptime estándar.
- **Módulos involucrados:** `dns_monitor`, `domain`, `alerts`.
- **Alcance:**
  - Chequeo periódico de IPs/dominios contra listas RBL públicas y validación continua de sintaxis/consistencia de `SPF`, `DKIM` y `DMARC`.

### 11. Modo MSP / Agencia (Consola Multi-Cliente)
- **Brecha de mercado:** Agencias y consultores de TI terminan mezclando recursos de distintos clientes o administrando decenas de cuentas separadas.
- **Módulos involucrados:** `organizations`, `users`, `status_page`, `reports`.
- **Alcance:**
  - Vista Partner/MSP para cambiar entre organizaciones clientes desde una sola sesión.
  - Plantillas de onboarding en 1 clic (crear Uptime + SSL + DNS + Domain + Security Headers para un dominio nuevo) y acceso *viewer* dedicado por cliente.

### 12. Postmortem automático y Status Page con suscriptores
- **Brecha de mercado:** Redactar postmortems manuales y notificar manualmente a usuarios finales consume tiempo clave tras resolver una caída.
- **Módulos involucrados:** `incidents`, `status_page`, `notifications`, `audit`.
- **Alcance:**
  - Generador de borrador de Postmortem a partir de la línea de tiempo real del incidente (detección, cambios previos DNS/SSL, `ack`, participantes, resolución y duración).
  - Suscripción de usuarios finales por correo/webhook a componentes específicos de `status_page`.
