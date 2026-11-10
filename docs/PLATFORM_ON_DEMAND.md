# Consola: consultas bajo demanda

Solo Auditoría requiere una consulta explícita. Resumen, Organizaciones, Usuarios
y Beta cargan automáticamente al abrir su sección. Salud consulta al entrar y después
sólo al pulsar Actualizar diagnóstico; regresar conserva la captura. El contexto
comercial del Resumen se consulta únicamente al desplegarlo. Los filtros del directorio
se aplican automáticamente y restablecen la primera página.
Auditoría permite correo parcial, organización por nombre/slug, acción, módulo,
resultado y fechas con hora del navegador. Hasta es exclusivo. La consulta paginada
devuelve 25 eventos y has_next; no necesita descargar directorios ni contar todo
el histórico. Los filtros se aplican en servidor al pulsar Consultar auditoría.
Los accesos desde las distribuciones del resumen consultan el directorio filtrado.
Organizaciones usa páginas de 25; el API conserva la respuesta anterior sin `page`.
Los conteos de usuarios, targets y agentes se calculan mediante subconsultas,
evitando tres consultas adicionales por cada organización.
Exportar ofrece todas las organizaciones o solo los filtros aplicados, sin limitarse
a la página visible. La ficha consulta su sección al abrir cada pestaña; los siete listados de recursos
sólo se consultan al seleccionar un módulo. La ficha de usuario se consulta al abrirla. Las listas
internas están paginadas. El contrato sin `section` conserva el detalle anterior.

La consola conserva los filtros durante navegación interna. Solo la pestaña se
guarda en la URL; filtros y correos no se persisten en URL ni almacenamiento local.
Las consultas de eventos de auditoría se mantienen manuales incluso al regresar
a la pestaña. Los catálogos de opciones se consultan aparte y no descargan eventos.

`is_test` se asigna manualmente con motivo auditado; no modifica planes ni cuotas.
Los registros anteriores quedan en `false`; no hay inferencias por nombre/correo.
El resumen comercial excluye los marcados como prueba; el directorio permite todos.

Requiere migraciones organizations.0008 y 0009; aplicadas en auditoría y posteriormente
en el entorno de desarrollo local para resolver el 500 del acceso por columna ausente.
Las acciones de plan, prueba y suspensión requieren `reason` (3–500 caracteres).
Validación y comandos reproducibles: [informe de consola](PLATFORM_VALIDATION_2026-11-08.md).

La consola orientada a beta requiere además accounts.0011 para los dos enlaces
externos de comentarios. Esta migración se validó en sentinel_audit; su aplicación
al entorno habitual queda separada. [Operación y evidencia](PLATFORM_BETA_CONSOLE_2026-11-09.md).
