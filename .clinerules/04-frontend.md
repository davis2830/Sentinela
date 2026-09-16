# Frontend Rules

## Framework

React + TypeScript.

## UI

Diseño limpio.

Priorizar simplicidad.

Dark Mode desde el inicio.

Responsive obligatorio.

## Components

Crear componentes pequeños.

Una responsabilidad por componente.

Evitar componentes gigantes.

## State

Preferir React Query para datos del servidor.

No duplicar estados innecesariamente.

## Communication

Todo acceso al backend debe realizarse mediante servicios API.

Nunca realizar lógica de negocio en el frontend.

## Charts

Utilizar Recharts.

No exponer Grafana directamente al cliente.
## Design System & Semántica Estricta de Colores (NOC / SRE)

El sistema implementa un marco semántico estricto para eliminar ambigüedades operativas en el centro de control:
- **🟢 accent-green (#10b981): Healthy / Online / SLA Óptimo** (Servidor UP, SLA >= 99.9%, HTTP 200, certificados válidos >30d).
- **🟡 accent-yellow (#F59E0B): Warning / Degraded / Atención** (Latencia alta >umbral, SSL por expirar <=30d, flapping detectado, incidente en mitigación).
- **🔴 accent-red (#EF4444): Critical / Down / Falla Activa** (Servidor DOWN, HTTP 5xx, incidentes críticos abiertos, certificados expirados).
- **🔵 accent-cyan (#06B6D4 / #22D3EE): Información / Telemetría / Métricas** (Latencia en ms, gráficos de telemetría viva, throughput requests/seg, consultas DNS, telemetría WHOIS).
- **🟣 accent-purple (#8B5CF6): Automatización / Funcionalidades Especiales / Cripto** (Webhooks, integraciones Slack/Discord/Telegram, auto-remediación, tokens API y 2FA).
- **⚪ text-dim / border-base (#64748B): Neutral / Pausado / Desactivado** (Servicios en mantenimiento, timestamps, IDs/UUIDs).
