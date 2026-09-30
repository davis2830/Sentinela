# 🛠️ Sentinel Developer Workflow & Convenciones de Ingeniería

Este documento establece las reglas obligatorias de desarrollo, sincronización con Docker, diseño visual de interfaz y estándares de rendimiento para cualquier desarrollador o agente que trabaje en Sentinel.

---

## 💻 1. Convenciones de Entorno y Sincronización Docker

Debido a la estructura del entorno de desarrollo local en Windows:

- **Directorio de Código Montado en Docker:** `c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\`
- **Workspace de Edición Principal:** `C:\Users\feshernandez\GC_OPS_OBS\`

### ⚠️ Regla de Sincronización Obligatoria
Tras realizar cambios en el frontend, backend o archivos de configuración, sincronizar siempre hacia el repositorio clonado con PowerShell:

```powershell
# Sincronización de Frontend
Copy-Item -Path "c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\frontend\src\*" -Destination "C:\Users\feshernandez\GC_OPS_OBS\frontend\src\" -Recurse -Force

# Sincronización de Documentación y Reglas
Copy-Item -Path "c:\Users\feshernandez\Downloads\GC_OPS-master\GC_OPS_OBS\AGENTS.md" -Destination "C:\Users\feshernandez\GC_OPS_OBS\AGENTS.md" -Force
```

### 🔄 Comandos de Reinicio de Contenedores
```powershell
# Reiniciar backend tras cambios en modelos, settings o migraciones
docker restart sentinel_backend
docker restart sentinel_celery_worker

# Reiniciar frontend tras cambios en dependencias o variables de entorno
docker restart sentinel_frontend
```

---

## 🎨 2. Tokens de Color y Semántica Estricta del NOC

Para mantener la rigurosidad operativa de un centro de control (NOC/SRE), el sistema implementa un código semántico inmutable:

### Superficies y Fondos
- `bg-dark` / `bg-main`: `#090D11` — Fondo base ultra oscuro.
- `bg-card`: `#111720` — Tarjetas KPI, contenedores elevados, drawers y modales.
- `bg-card-hover`: `#17202C` — Estado hover sobre filas y botones secundarios.
- `border-base`: `#1E293B` — Delimitador sutil estándar.
- `border-accent`: `#263345` — Borde de foco o resalte.

### Acentos Semánticos Estrictos
| Color Token | Código Hex | Semántica Operativa | Uso en Interfaz |
| :--- | :---: | :--- | :--- |
| `accent-green` | `#10B981` | **Healthy / Online / SLA Óptimo** | Servicios UP, HTTP 200, SSL > 30d, tests exitosos. |
| `accent-green-glow`| `#34D399` | **Pulsante en Vivo** | Halos de radar activos y auto-refresco. |
| `accent-yellow` | `#F59E0B` | **Warning / Degraded / Atención** | Latencia alta, SSL <= 30d, flapping, incidente en mitigación. |
| `accent-red` | `#EF4444` | **Critical / Down / Falla Activa** | Servicio caído, HTTP 5xx, incidentes abiertos, certificados expirados. |
| `accent-cyan` | `#06B6D4` | **Telemetría / Métricas** | Latencia en ms, throughput de peticiones/seg, consultas DNS. |
| `accent-purple` | `#8B5CF6` | **Automatización / Agentes / Privado** | Agentes Satélite LAN, webhooks, llaves API y 2FA. |
| `text-dim` | `#64748B` | **Neutral / Pausado** | Servicios en mantenimiento o desactivados. |

### Reglas de Diseño Estricto:
1. **Cero Emojis en Componentes UI:** Utilizar exclusivamente iconos vectoriales de `lucide-react`.
2. **Cero Mayúsculas Sostenidas (Uppercase):** Mantener capitalización natural tipo oración.
3. **Geometría Suavizada:** Contenedores `rounded-2xl`, modales `rounded-2xl` o `rounded-3xl` y badges en píldora `rounded-full`.
4. **Tipografía Dual:** `Outfit` para textos, títulos y navegación; `JetBrains Mono` exclusivamente para datos técnicos (IPs, latencias en ms, timestamps, códigos HTTP y hashes).

---

## ⚡ 3. Estándares de Backend y Rendimiento de Base de Datos

### Erradicación Total de Consultas N+1:
- **Siempre usar `select_related`** para claves foráneas directas (`ForeignKey`, `OneToOne`).
- **Siempre usar `prefetch_related`** con `Prefetch()` acotado por tiempo o condiciones para relaciones Many-to-Many o consultas inversas hacia TimescaleDB.
- **Serialización en Lote:** Si un serializador requiere datos relacionados complejos, implementar `list_serializer_class` para precargar en lote en memoria O(1) en lugar de consultar dentro de `to_representation`.
- **Caché en Redis (DB 2):** Endpoints de alto volumen que alimentan dashboards globales deben usar `cache.get()` con TTL corto (10s a 30s) para soportar múltiples operadores concurrentes sin golpear la base de datos.

---

## 🧪 4. Verificaciones Previas al Commit

Antes de considerar terminada una funcionalidad:

1. **Frontend (TypeScript):**
   ```bash
   cd frontend && npm run build
   ```
   *Debe compilar con 0 errores de tipos.*

2. **Backend (Pruebas & Lint):**
   ```powershell
   docker exec -it sentinel_backend python manage.py check
   docker exec -it sentinel_backend python manage.py migrate --check
   ```

3. **Carga y Latencia (k6):**
   ```powershell
   cd tests_perf && .\run_perf.ps1
   ```
   *El p95 debe mantenerse por debajo de 60 ms y 0% de errores HTTP.*
