# Conectividad: acciones directas y selección independiente en tarjetas

Revisión local del 12 de noviembre de 2026. Ajusta la presentación de acciones y tarjetas en los seis módulos de Conectividad.

- Editar, eliminar y vincular alertas vuelven a estar visibles como iconos directos mediante `ResourceActionButtons`. Se mantienen sus callbacks, permisos, tooltips y nombres accesibles.
- Cada icono conserva una superficie de 32×32 px dentro de un objetivo transparente de 44×44 px. El hover se aplica únicamente al botón señalado, sin heredar el hover de toda la tarjeta.
- La selección de tarjetas queda en el pie, con posición independiente y espacio reservado. El nombre, destino, estado e icono recuperan el espacio del encabezado. Marcar y desmarcar no desplaza su contenido.
- En Uptime se retira el contenedor grande de acciones y se recupera el orden alerta, editar y eliminar. Los pies de las tarjetas quedan alineados.
- La cuadrícula conserva un máximo de tres columnas en pantallas amplias y reduce columnas cuando falta ancho. Se comprueban tarjetas con etiquetas, agente privado, nombres largos y estados distintos.
- Las utilidades del directorio, los filtros y la paginación mantienen su funcionamiento.

## Verificación local

- Django completo, base aislada: **399 aprobadas**.
- Chromium: **20 escenarios distintos aprobados**, incluyendo acciones directas, editar/cancelar, confirmaciones, retorno del foco, selección en el pie sin desplazamiento del título, paginación y regresiones de Uptime y Viewer.
- Revisión adicional de cuadrícula a 1900, 1440 y 1024 px: tres, dos y una columna respectivamente, sin desbordamiento del documento. Las comprobaciones comunes incluyen 1366×768 y 390×844.
- TypeScript/build, ESLint y formato: aprobados.
- El frontend local en `localhost:3001` sirve los componentes actualizados. Sin cambios de contratos ni migraciones; los recorridos utilizan fixtures y no modifican recursos de clientes.

Registros: `.tmp/connectivity-direct-actions-django.log`, `.tmp/connectivity-direct-actions-final.log`, `.tmp/connectivity-direct-actions-grid-final.log`, `.tmp/connectivity-direct-actions-build-delivery.log` y `.tmp/connectivity-direct-actions-lint-delivery.log`. Evidencia local, separada de CI remoto y despliegue.

## Capturas

- Uptime con estados, agentes y etiquetas: [pantalla amplia](assets/connectivity-direct-actions-20261112/monitoring-mixed-grid-1900.png) y [1440 px](assets/connectivity-direct-actions-20261112/monitoring-mixed-grid-1440.png).
- Tarjetas: [Uptime](assets/connectivity-direct-actions-20261112/monitoring-grid.png), [SSL](assets/connectivity-direct-actions-20261112/ssl-grid.png), [DNS](assets/connectivity-direct-actions-20261112/dns-grid.png), [Dominios](assets/connectivity-direct-actions-20261112/domains-grid.png), [API](assets/connectivity-direct-actions-20261112/api-checks-grid.png) y [Security Headers](assets/connectivity-direct-actions-20261112/security-headers-grid.png).
