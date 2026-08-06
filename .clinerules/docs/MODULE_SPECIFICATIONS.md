# Module Specifications

## Objetivo

Este documento define las responsabilidades de cada módulo del sistema Sentinel.

Cada módulo debe representar un dominio funcional del negocio.

No se permite mezclar responsabilidades entre módulos.

Antes de crear un nuevo módulo, verificar si la funcionalidad realmente pertenece a un dominio existente.

---

# Accounts

## Responsabilidad

Gestionar la autenticación e identidad de los usuarios.

## Funciones

- Login
- Logout
- Refresh Token
- Recuperación de contraseña
- Cambio de contraseña
- MFA (Futuro)

## No debe hacer

- Administrar organizaciones
- Administrar monitoreos
- Administrar alertas

---

# Organizations

## Responsabilidad

Administrar clientes (tenants).

## Funciones

- Crear organizaciones
- Configuración general
- Plan contratado
- Límites
- Preferencias

## No debe hacer

- Gestionar usuarios autenticados
- Ejecutar monitoreos
- Procesar alertas

---

# Users

## Responsabilidad

Administrar usuarios dentro de una organización.

## Funciones

- Crear usuarios
- Editar usuarios
- Roles
- Permisos
- Equipos

## No debe hacer

- Gestionar autenticación
- Ejecutar monitoreos

---

# Monitoring

## Responsabilidad

Administrar todos los objetivos de monitoreo.

## Funciones

- Crear Target
- Editar Target
- Eliminar Target
- Programar verificaciones
- Estado actual

## Tipos

- HTTP
- HTTPS
- TCP
- DNS
- API
- SSL

## No debe hacer

- Enviar alertas
- Ejecutar automatizaciones

---

# SSL

## Responsabilidad

Analizar certificados SSL.

## Funciones

- Fecha de expiración
- Cadena de certificados
- Algoritmos
- Días restantes

## No debe hacer

- Administrar DNS
- Administrar API Checks

---

# DNS

## Responsabilidad

Monitorear registros DNS.

## Funciones

- A
- AAAA
- MX
- TXT
- NS
- CNAME

Registrar historial de cambios.

---

# Domain

## Responsabilidad

Consultar información WHOIS.

## Funciones

- Fecha de expiración
- Registrar
- Estado
- Cambios

---

# API Checks

## Responsabilidad

Validar APIs.

## Funciones

- HTTP Status
- Tiempo de respuesta
- Validación JSON
- Validación Schema
- Validación Headers

No limitarse a verificar HTTP 200.

---

# Alerts

## Responsabilidad

Generar alertas.

## Funciones

- Evaluar reglas
- Detectar incidentes
- Crear alertas

## No debe hacer

- Enviar correos
- Enviar Teams
- Enviar Slack

Eso pertenece a Notifications.

---

# Notifications

## Responsabilidad

Entregar mensajes.

## Canales

- Email
- Slack
- Teams
- Webhook
- Push

Debe ser completamente independiente del motor de alertas.

---

# Incidents

## Responsabilidad

Gestionar incidentes.

## Funciones

- Apertura
- Seguimiento
- Cierre
- Línea de tiempo

No debe generar monitoreos.

---

# Reports

## Responsabilidad

Generar reportes.

## Tipos

- SLA
- Disponibilidad
- SSL
- Incidentes
- Tendencias

---

# Billing

## Responsabilidad

Administrar suscripciones.

## Funciones

- Planes
- Facturación
- Límites
- Consumo

Nunca contener lógica de monitoreo.

---

# Audit

## Responsabilidad

Registrar acciones.

Registrar:

- Login
- Cambios
- Eliminaciones
- Configuración
- Automatizaciones

Debe ser inmutable.

---

# Automation (Fase 3)

## Responsabilidad

Ejecutar acciones.

## Funciones

- Runbooks
- AWX
- Ansible
- Scripts

Toda automatización deberá pasar por autorización.

---

# AI (Fase 3)

## Responsabilidad

Asistir al operador.

## Funciones

- Explicar incidentes
- Recomendar acciones
- Detectar anomalías
- Generar reportes

Nunca ejecutar acciones automáticamente sin autorización.

---

# Dependencias permitidas

Accounts

↓

Organizations

↓

Users

↓

Monitoring

↓

Alerts

↓

Notifications

↓

Incidents

↓

Reports

↓

Automation

Evitar dependencias circulares.

---

# Regla de Oro

Un módulo debe poder evolucionar sin modificar los demás.

Si una funcionalidad obliga a modificar múltiples módulos, reconsiderar el diseño.

Cada módulo debe cumplir el principio de Responsabilidad Única (SRP) y mantener un bajo acoplamiento con el resto del sistema.