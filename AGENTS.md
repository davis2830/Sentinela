# Project: Sentinel (GC_OPS_OBS)

## 📌 Contexto General del Proyecto
**Sentinel** es una plataforma de observabilidad y operaciones (NOC / Observabilidad operativa) orientada a la monitorización y automatización de infraestructura y servicios críticos.

## 🛠️ Stack Tecnológico
- **Backend:** Python 3.13 / Django REST Framework, Celery para tareas asíncronas / background workers.
- **Base de Datos:** PostgreSQL con extensión TimescaleDB para métricas de series de tiempo.
- **Cache / Message Broker:** Redis.
- **Observabilidad / Agentes:** Grafana Alloy, Prometheus relabeling / exporters.
- **Frontend:** React + TypeScript con Vite, componentes de UI para dashboards de monitorización de infraestructura.
- **Contenedores:** Docker & Docker Compose (`docker-compose.yml`).

## 📁 Reglas del Proyecto
Este proyecto contiene especificaciones y estándares detallados en la carpeta [`.clinerules/`](file:///.clinerules/):
- `00-sentinel-master.md`: Reglas maestras del proyecto.
- `01-architecture.md`: Arquitectura del sistema.
- `02-tech-stack.md`: Stack tecnológico y dependencias.
- `03-backend.md`: Estándares de backend y endpoints.
- `04-frontend.md`: Estándares de frontend y componentes.
- `05-database.md`: Modelado y base de datos TimescaleDB.
- `06-coding-standards.md`: Estándares de código y buenas prácticas.
- `07-roadmap.md`: Fases y roadmap de producto.

## 🚀 Estado de Avances Realizados
- **Slice 4 (SSL + DNS + Domain / Uptime & Latencia):** Implementado al 100% (6 fases completadas):
  1. *Fase 1:* Escaneo Manual bajo Demanda (`POST /api/v1/monitoring/{id}/scan/`).
  2. *Fase 2:* Gráfica Histórica de Latencia ([`LatencyChart.tsx`](file:///frontend/src/components/monitoring/LatencyChart.tsx)).
  3. *Fase 3:* Nivel de Servicio SLA & Disponibilidad ([`SLACard.tsx`](file:///frontend/src/components/monitoring/SLACard.tsx)).
  4. *Fase 4:* Buscador & Filtros Rápidos por Estado.
  5. *Fase 5:* Configuración HTTP Avanzada & Encabezados Custom ([`TargetForm.tsx`](file:///frontend/src/components/monitoring/TargetForm.tsx)).
  6. *Fase 6:* Botón directo "Vincular Alerta" (1-Clic hacia `/alerts`).
- **Modernización NOC Uptime & Latencia (UI, UX & Funcionalidades):**
  - KPI Cards de Nivel Superior (Disponibilidad Global SLA, Latencia Promedio, Salud y Auto-refresco en vivo).
  - Rediseño de [`TargetCard.tsx`](file:///frontend/src/components/monitoring/TargetCard.tsx) con radar pulsante y micro-bloques de disponibilidad (sparklines).
  - Vista de Tabla Compacta ([`TargetTableView.tsx`](file:///frontend/src/components/monitoring/TargetTableView.tsx)) con selector de vista (Grid vs Tabla).
  - Slide-Over Drawer lateral ([`TargetDetailDrawer.tsx`](file:///frontend/src/components/monitoring/TargetDetailDrawer.tsx)) para inspección de métricas sin salir de la lista.
  - Test de Conexión en Vivo en [`TargetForm.tsx`](file:///frontend/src/components/monitoring/TargetForm.tsx) con endpoint `POST /api/v1/monitoring/test-connection/`.
  - Acciones en Lote (Bulk Actions) para escanear, pausar, reanudar o eliminar targets en masa (`POST /api/v1/monitoring/bulk-action/`).
  - Suavizado integral de geometría: Contenedores `rounded-2xl` y modales `rounded-3xl`, badges y filtros en cápsula `rounded-full`, y scrollbars sutiles.
- **Persistencia Global de Vistas (Listado vs Cuadros):**
  - Creado [`usePersistentViewMode.ts`](file:///frontend/src/hooks/usePersistentViewMode.ts) con almacenamiento en `localStorage` por módulo.
  - Implementado en los 9 módulos principales (`MonitoringPage`, `SSLCertificatesPage`, `DNSRecordsPage`, `DomainsPage`, `APIChecksPage`, `SecurityHeadersPage`, `IncidentsPage`, `DashboardPage`, `ReportsPage`). La vista seleccionada (tabla/lista vs grid) se preserva permanentemente tras actualizar con F5, auto-refresco o navegación entre rutas.
- **Robustecimiento del Módulo de Monitoreo SSL (`SSLCertificatesPage.tsx` & `backend/ssl_monitor/`):**
  - **Soporte Multi-Puerto y Servicios Especiales:** Soporte para puertos personalizados (`:443`, `:8443`, `:636` LDAPS, `:993` IMAP).
  - **Grado de Seguridad Criptográfica:** Evaluación automática de seguridad TLS (`A+`, `A`, `B`, `F`) basada en versión TLS (1.3 / 1.2), vigencia y certificados válidos.
  - **Timeline Visual de Vida Útil:** Micro-barra de progreso con porcentaje de vida del certificado transcurrido desde fecha de emisión hasta vencimiento.
  - **Test de Conexión en Vivo:** Endpoint `POST /api/v1/ssl-certificates/test-connection/` y botón interactivo en el modal para probar la conexión TLS antes de registrar el certificado.
  - **Acciones en Lote:** Endpoint `POST /api/v1/ssl-certificates/bulk-action/` para re-escanear o eliminar certificados en masa.
  - **Exportación de Inventario SSL:** Descarga de reporte completo en formato CSV con vigencia, emisor, grado y SANs para auditorías ISO 27001.
- **Robustecimiento del Módulo de Registros DNS (`DNSRecordsPage.tsx` & `backend/dns_monitor/`):**
  - **Soporte de Tipos Extendidos:** Soporte para `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SOA` (Start of Authority), `PTR` (Reverse DNS) y `CAA` (Certification Authority Authorization).
  - **Medición de Latencia de Consulta (`response_time_ms`):** Medición de tiempo de respuesta de resolución en milisegundos con badge por colores (`<50ms` verde, `<150ms` azul, `>150ms` ámbar).
  - **Detección de Políticas SPF / DMARC:** Análisis automático de registros `TXT` con identificación de políticas anti-spoofing (`v=spf1`, `v=DMARC1`).
  - **Test de Resolución DNS en Vivo:** Endpoint `POST /api/v1/dns-records/test-resolution/` y botón interactivo en el modal para validar respuestas, TTL y latencia antes de guardar.
  - **Historial de Mutaciones con Diff Visual:** Pestaña de historial con desglose de valores agregados (`+` verde) y removidos (`-` rojo), más badge pulsante *"Mutación 24h"* en la tabla.
  - **Acciones en Lote & Exportación CSV:** Endpoint `POST /api/v1/dns-records/bulk-action/` para re-resolución o eliminación masiva, y botón de exportación CSV con UTF-8 BOM.
- **Scripts de Alloy:** `extract_metrics.py` en `scripts_alloy/` para parseo de métricas de Windows y generación de regex relabeling para Grafana Alloy.

## 🎨 Paleta Oficial de Colores (Design System Tokens)
- **Fondos y Superficies:**
  - `bg-dark` / `bg-main`: `#090D11` (Fondo base global ultra oscuro).
  - `bg-card`: `#111720` (Contenedores elevados, tarjetas KPI, drawers y modales).
  - `bg-card-hover`: `#17202C` (Hover sobre filas interactivas y botones secundarios).
- **Bordes y Delimitadores:**
  - `border-base`: `#1E293B` (Borde sutil estándar).
  - `border-accent`: `#263345` (Borde de contraste / elementos en foco).
- **Tipografía y Textos:**
  - `text-main`: `#F8FAFC` (Blanco primario para títulos y métricas).
  - `text-muted`: `#94A3B8` (Gris intermedio para descripciones y labels).
  - `text-dim`: `#64748B` (Gris terciario para timestamps, metadatos y placeholders).
- **Acentos Semánticos & Estados:**
  - `accent-green`: `#10b981` (Online, Up, Pass, Valid, SLA óptimo) &bull; Fondo: `bg-accent-green/10`, Borde: `border-accent-green/30`.
  - `accent-green-glow`: `#34d399` (Halo de radar pulsante en vivo).
  - `accent-red`: `#EF4444` (Down, Fail, Invalid, Incidentes críticos) &bull; Fondo: `bg-accent-red/10`, Borde: `border-accent-red/30`.
  - `accent-yellow`: `#F59E0B` (Advertencias, Lento, Por expirar <= 30d) &bull; Fondo: `bg-accent-yellow/10`, Borde: `border-accent-yellow/30`.
  - `accent-blue`: `#3B82F6` (Informativo, telemetría de red, DNS) &bull; Fondo: `bg-accent-blue/10`, Borde: `border-accent-blue/30`.
  - `accent-purple`: `#8B5CF6` (Roles, autenticación, API tokens) &bull; Fondo: `bg-accent-purple/10`, Borde: `border-accent-purple/30`.
- **Reglas Estéticas Estrictas:**
  - Cero emojis (usar exclusivamente iconos vectoriales de `lucide-react`).
  - Cero mayúsculas sostenidas (`uppercase`).
  - Contenedores `rounded-2xl`, modales `rounded-2xl`/`rounded-3xl` y badges en cápsula `rounded-full`.
  - Tipografía `Outfit` para textos y `JetBrains Mono` solo para datos numéricos/técnicos.

## 🧩 Arquitectura Frontend: Sentinel NOC Layout Toolkit (`frontend/src/components/common/noc/`)
Para mantener el principio DRY (Don't Repeat Yourself) y garantizar una experiencia unificada en toda la plataforma, todas las vistas operativas deben implementar los siguientes componentes centrales:
- **`NOCPageHeader`:** Encabezado unificado con badge temático del módulo, radar pulsante de auto-refresco en vivo y ranura de botones de acción rápida.
- **`useAutoRefresh` (`frontend/src/hooks/useAutoRefresh.ts`):** Hook estándar de cuenta regresiva (15s/30s) en vivo, pausa/reanudación interactiva y compatibilidad nativa con `refetchInterval` de TanStack Query.
- **`NOCKpiGrid` y `NOCKpiCard`:** Rejilla y tarjetas KPI de nivel superior con barras de progreso visuales (gauges), micro-bloques de salud por estado y pie de métrica descriptivo.
- **`NOCToolbar`:** Barra de control con buscador Omnibar en tiempo real, selector de vista (Grid interactivo vs Tabla compacta) y chips/pills de filtrado con conteo de registros en vivo.
- **`NOCBulkActionBar`:** Barra flotante adhesiva inferior con desenfoque (`backdrop-blur-md`) para acciones masivas (escaneo por lote, eliminación o cierre masivo).
- **`NOCDrawer`:** Slide-Over lateral desplegable por la derecha con soporte para atajo de teclado `ESC`, navegación por pestañas e inspección técnica profunda sin pérdida de contexto ni reseteo de filtros.

## ⚡ Motor de Reglas y Alertas (`backend/alerts/`)
- **Aprovisionamiento Automático:** Si una organización no tiene reglas configuradas, el sistema auto-aprovisiona automáticamente 6 reglas estándar del NOC mediante `AlertRuleService.ensure_default_rules(organization_id)`:
  1. *Objetivo de Monitoreo Caído* (`status_down` &rarr; Severidad Crítica)
  2. *Latencia Alta de Respuesta* (`response_time_above > 1000ms` &rarr; Advertencia)
  3. *Certificado SSL por Expirar* (`ssl_expiring <= 30d` &rarr; Advertencia)
  4. *Fallo en API Check Sintético* (`api_check_failed` &rarr; Severidad Crítica)
  5. *Dominio WHOIS por Expirar* (`domain_expiring <= 30d` &rarr; Advertencia)
  6. *Puntuación de Seguridad Baja* (`security_score_below < 70` &rarr; Advertencia)
- **Evaluación Bajo Demanda:** Endpoint `POST /api/v1/alert-rules/evaluate/` evalúa las reglas filtradas por organización y devuelve estadísticas en tiempo real (`rules_evaluated`, `alerts_created` y mensaje descriptivo).
- **Auto-Resolución:** Las condiciones de estado (`status_down`) y latencia (`response_time_above`) auto-resuelven las alertas cuando el objetivo se recupera y vuelve a estado óptimo.

## 🌐 Módulos Homologados (100% Cobertura de Plataforma)
1. **Dashboard Principal** ([`DashboardPage.tsx`](file:///frontend/src/pages/DashboardPage.tsx)): Centro de comando con matriz de servicios unificada, franja de early warning, feed de alertas y drawer inspector.
2. **Uptime & Latencia** ([`MonitoringPage.tsx`](file:///frontend/src/pages/MonitoringPage.tsx)): Monitoreo HTTP/S, TCP, Ping, gráfica de latencia histórica y prueba de conexión en vivo.
3. **API Checks** ([`APIChecksPage.tsx`](file:///frontend/src/pages/APIChecksPage.tsx)): Pruebas sintéticas con verificación de headers y códigos de respuesta.
4. **Certificados SSL** ([`SSLCertificatesPage.tsx`](file:///frontend/src/pages/SSLCertificatesPage.tsx)): Vigencia de certificados, emisores CA y dominios SANs.
5. **Dominios WHOIS** ([`DomainsPage.tsx`](file:///frontend/src/pages/DomainsPage.tsx)): Vencimiento de registros ICANN y nameservers.
6. **Registros DNS** ([`DNSRecordsPage.tsx`](file:///frontend/src/pages/DNSRecordsPage.tsx)): Resolución de zonas y detección de mutaciones en registros.
7. **Cabeceras de Seguridad** ([`SecurityHeadersPage.tsx`](file:///frontend/src/pages/SecurityHeadersPage.tsx)): Auditoría HSTS, CSP, Anti-Clickjacking y calificaciones Mozilla Observatory.
8. **Gestión de Incidentes** ([`IncidentsPage.tsx`](file:///frontend/src/pages/IncidentsPage.tsx)): Controlador del ciclo de vida interactivo y bitácora de seguimiento.
9. **Centro de Alertas** ([`AlertsPage.tsx`](file:///frontend/src/pages/AlertsPage.tsx)): Gestión de reglas de umbral, elevación a incidentes y resolución masiva.
10. **Reportes Ejecutivos & SLA** ([`ReportsPage.tsx`](file:///frontend/src/pages/ReportsPage.tsx)): Informes de disponibilidad con exportación directa a CSV y PDF.

## 💻 Convenciones de Entorno y Sincronización Docker
- **Directorio de Trabajo / Código Montado en Docker:** `c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\`
- **Workspace Clonado en Perfil:** `C:\Users\feshernandez\GC_OPS_OBS\`
- **Regla de Sincronización Obligatoria:** Tras realizar cambios en el frontend o backend, sincronizar siempre hacia el repositorio clonado con:
  ```powershell
  Copy-Item -Path "c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\frontend\src\*" -Destination "C:\Users\feshernandez\GC_OPS_OBS\frontend\src\" -Recurse -Force
  Copy-Item -Path "c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\AGENTS.md" -Destination "C:\Users\feshernandez\GC_OPS_OBS\AGENTS.md" -Force
  ```
- **Reinicio de Contenedores:**
  ```powershell
  docker restart sentinel_frontend
  docker restart sentinel_backend
  ```


