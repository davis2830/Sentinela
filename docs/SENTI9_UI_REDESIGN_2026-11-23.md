# Rediseño Integral UI/UX Senti9 (Modern Web Guidance)

**Fecha:** 23 de noviembre de 2026  
**Módulo:** Senti9 (`/senti9`) — Agentes de Monitoreo Privado  
**Directrices aplicadas:** Modern Web Guidance, Sentinel NOC Design System, Tailwind CSS v3  

---

## 1. Contexto y Objetivos

El módulo de Senti9 permite a los clientes desplegar agentes privados en contenedores Docker (dentro de sus propias redes locales, datacenters o máquinas virtuales en la nube como Oracle Cloud) para monitorizar endpoints que no están expuestos a Internet.

### Diagnóstico Inicial de UI/UX
- **Falta de jerarquía visual:** El módulo presentaba un layout rígido con una columna lateral fija de 300px que limitaba la visualización de los agentes a un espacio reducido.
- **Densidad de datos sin estructurar:** Los datos de telemetría (colas, CPU, memoria, versión de agente, latencia, red) estaban amontonados sin agrupamiento semántico.
- **Deuda técnica CSS:** Dependía de un archivo monolítico `senti9.css` de más de 1,047 líneas con reglas CSS independientes desconectadas del sistema de tokens y temas de Sentinel.
- **Onboarding poco intuitivo:** El proceso de instalación no proporcionaba retroalimentación en tiempo real durante la espera de la primera señal del agente.

---

## 2. Componentes y Arquitectura Rediseñada

### 2.1. Cabecera y KPIs Ejecutivos (`NOCPageHeader` & `NOCKpiGrid`)
Se integraron los componentes estándar del sistema NOC:
- **`NOCPageHeader`:** Identidad clara con título "Senti9 · Agentes Privados", subtítulo contextual ("Watchdogs de red local para endpoints privados y VPNs"), botón primario "Registrar Senti9" y botón secundario "Guía de instalación".
- **`NOCKpiGrid` (4 Tarjetas KPI):**
  1. **Guardianes Activos:** Conteo de agentes con estado `ONLINE` y heartbeat reciente (<3m).
  2. **Monitores LAN:** Cantidad acumulada de endpoints asignados y supervisados internamente.
  3. **Frecuencia de Polling:** Frecuencia estándar de ejecución y latido (`10s`).
  4. **Salud de la Flota:** Porcentaje de agentes saludables (`is_online / total`), con barra de progreso dinámica (verde >80%, amarillo <80%).

### 2.2. Barra de Herramientas y Filtros (`NOCToolbar`)
Sustituyó la barra anterior por un componente reactivo con:
- Búsqueda textual interactiva en tiempo real (por nombre de agente, hostname, ID o IP).
- Píldoras de filtrado por estado (`NOCStatusPill`):
  - **Todos**
  - **Conectados** (agentes online)
  - **Desconectados** (agentes con señal perdida)
  - **Esperando Señal** (agentes creados que aún no envían el primer heartbeat)
  - **Revocados** (agentes con token invalidado por seguridad)
- Indicador en vivo de auto-refresco y cuota de agentes de la organización.

### 2.3. Modo Lista Homologado (`Senti9TableView`) y Tarjetas Alternativas (`Senti9AgentCard`)
- **Modo Lista Limpio (Vista por Defecto):** Implementado con la misma estética de directorio que `TargetTableView` y `DomainTableView`:
  - Balizas de estado con pulsación (`Online`, `Desconectado`, `Esperando Señal`, `Revocado`).
  - Nombre del agente con copiado rápido de hostname/UUID en un clic.
  - Indicador de plataforma (Linux / Windows) y versión del agente (`v1.8.0`).
  - Conteo de monitores LAN asignados con icono de servidor.
  - Último latido registrado con formato de fecha y hora local.
  - Telemetría de cola interna (comprobaciones encoladas/en ejecución/por enviar).
  - Acciones rápidas en línea: "Crear monitor LAN", "Ver operaciones", "Instalación".
- **Selector de Vista Cuadrícula / Lista en Toolbar:** Integrado en `NOCToolbar` mediante `usePersistentViewMode("senti9", "table")`. Permite alternar entre la tabla limpia y las tarjetas ricas en datos.

### 2.4. Modernización del Onboarding y Eliminación de Flechas Nativas
- Se eliminaron las flechas por defecto del navegador (`►` y `▼`) en todos los bloques colapsables (`<details><summary>`), empleando `list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden`.
- Se incorporaron iconos temáticos SVG (`ShieldCheck`, `Terminal`, `Layers`, `Wrench`, `Settings2`) acompañados de un indicador `ChevronDown` con animación de rotación fluida (`group-open:rotate-180`).
- En el modal de registro `Senti9Setup`, los botones de transición reemplazaron flechas genéricas por iconos contextuales de terminal, radio y verificación.
- En `Senti9RefreshStatus`, se retiró la etiqueta `"hace menos de 1 min"` para mantener una interfaz sobria y limpia.

### 2.4. Drawer Lateral Unificado (`NOCDrawer` & `Senti9Operation`)
- Al seleccionar un agente se abre un panel lateral completo con navegación por pestañas:
  - **Operación y Telemetría:** Gráficos de colas internas (en espera, ejecutando, por enviar), capacidad de cola, fallos consecutivos, drenaje y monitores asignados.
  - **Instalación y Token:** Comandos Docker generados con un clic, variables de entorno y soporte para rotar o revocar tokens con impacto visible.

### 2.5. Wizard de Despliegue con Radar en Tiempo Real (`Senti9Setup`)
Flujo asistido de 3 pasos para conectar agentes:
1. **Paso 1: Identificación y Plataforma:** Nombre del agente, selector de plataforma (Windows Docker Desktop / Linux Engine) y resumen de cuota.
2. **Paso 2: Descarga de Token y Comando Docker:** Descarga obligatoria del archivo secreto de token, verificación mediante checkbox y comando `docker run` listo para copiar y pegar.
3. **Paso 3: Verificación con Baliza Radar:**
   - Animación de círculos concéntricos de radar con barrido activo.
   - Sondeo reactivo cada 10 segundos al endpoint `/api/v1/agent-probes/{id}/detail/`.
   - Transición automática a estado de éxito con confirmación instantánea en cuanto el contenedor envía su primer heartbeat.
   - Diagnóstico asistido y botón de reintento en caso de agotarse el tiempo límite (2 minutos).

---

## 3. Purga de CSS Legado

- El archivo `frontend/src/components/monitoring/senti9.css` (1,047 líneas) fue purgado completamente.
- Ningún componente de la aplicación importa ni utiliza clases con prefijo `senti9-*`.
- Todos los estilos fueron refactorizados a utilidades nativas de Tailwind CSS, garantizando consistencia con el tema oscuro Sentinel NOC (`#090D11`, `#111720`, `#10B981`, `#38BDF8`).

---

## 4. Verificación de Compilación y Rendimiento

```bash
docker exec -u 0 sentinel_frontend sh -c "rm -rf /app/dist && npm run build"
```
- **Resultado:** Código de salida `0` (Exitoso).
- **TypeScript:** 0 errores de tipado en modo estricto (`tsc`).
- **Vite:** 2,434 módulos transformados y empaquetados en 18.76 segundos.
- **Bundle CSS:** El archivo independiente `Senti9Page.css` fue eliminado; los estilos están unificados y comprimidos en el bundle global.
