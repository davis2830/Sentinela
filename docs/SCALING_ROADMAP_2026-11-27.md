# Sentinel NOC — Hoja de Ruta de Escalamiento Arquitectónico (2026-11-27)

## Principio rector

Sentinel opera actualmente como un **monolito modular** (`React + Nginx + Django/Gunicorn + Celery + PostgreSQL + Redis` sobre Docker Compose). En una plataforma de monitoreo, el 90% de la carga no proviene del tráfico web sino de **los chequeos periódicos, las escrituras de telemetría y los heartbeats de Senti9**.

Por ello, la estrategia de crecimiento es **evolutiva** (Monolito Modular → Separación de cargas → Extracción selectiva de servicios) y evita migrar prematuramente a microservicios mientras el producto valida sus primeros clientes.

---

## Etapas de crecimiento

### Etapa 1 — Escalar sin cambiar de arquitectura (~1,000 a 10,000 targets)
Exprimir el monolito modular actual sacando los cuellos de botella de un único VPS:

- [ ] **Base de datos y Redis dedicados:** mover PostgreSQL y Redis fuera del VPS de aplicación (instancias gestionadas o nodos separados).
- [ ] **Connection pooling (`PgBouncer`):** evitar agotamiento de conexiones entre múltiples workers de Gunicorn y Celery.
- [ ] **Escalado horizontal de `celery_worker` por colas:** dedicar nodos exclusivos a las colas ya existentes (`high_priority`, `monitoring`, `background`, `celery`) sin levantar web/frontend.
- [ ] **Particionamiento de telemetría:** particionar por mes las tablas de resultados históricos (`MonitoringCheck`, `APICheckResult`, etc.) o habilitar **TimescaleDB** sobre PostgreSQL para evitar bloqueos en `purge_telemetry` y mantener consultas rápidas.
- [ ] **Read Replica:** dirigir lecturas pesadas (`reports/`, series de tiempo y listados históricos) a una réplica de lectura.

### Etapa 2 — Separar Plano de Control del Plano de Ejecución (~10,000 a 50,000+ targets)
Dividir por **perfil de carga**, manteniendo la lógica de negocio unificada:

- [ ] **Control Plane (Django monolito modular):** conserva `accounts`, `organizations`, `users`, `incidents`, `alerts`, `reports`, `status_page` y `audit`.
- [ ] **Execution Plane (*Cloud Runners* distribuidos):** extraer la ejecución de checks HTTP/TCP/SSL/DNS de Celery/Python a runners ligeros en Go o Rust desplegados en múltiples regiones (habilitando además monitoreo multi-región real).
- [ ] **Gateway de Ingesta Senti9:** si miles de agentes envían heartbeats cada 10–30 s, separar `/api/v1/agent-probes/heartbeat/` y la recepción de resultados a un servicio async ligero (FastAPI o Go) que valide en Redis, encole en lote y responda `202 Accepted`.

### Etapa 3 — Almacenamiento especializado y Broker robusto (50,000+ targets)
- [ ] **Separar métricas de estado relacional:** mantener PostgreSQL para entidades transaccionales/configuración y mover series de tiempo crudas a **ClickHouse** o **TimescaleDB**.
- [ ] **Separar Caché de Cola de Mensajes:** dejar Redis/Valkey para caché, sesiones y rate-limiting; mover colas de checks e ingesta a **RabbitMQ, NATS o Kafka**.
- [ ] **Orquestación multi-nodo:** migrar de `docker-compose.prod.yml` a **Kubernetes (k3s/EKS)**, **Nomad** o **ECS** con autoescalado de workers por profundidad de cola.

---

## Disciplinas a mantener desde hoy en el código

1. **Lógica en `services.py` y `runners.py`:** evitar lógica de negocio en `views.py` o modelos para poder cambiar el motor de ejecución o almacenamiento sin reescribir endpoints.
2. **Sin `JOIN`s pesados hacia telemetría masiva:** en listados y módulos administrativos usar anotaciones/resúmenes acotados (patrón aplicado en `common/scan_serializers.py`).
3. **Contratos de cola autocontenidos:** pasar IDs y payloads JSON simples en tareas Celery y reportes de Senti9, sin depender de estado en memoria local.
4. **Backend *stateless*:** no persistir archivos ni sesiones en el sistema de archivos local del contenedor `backend`.
