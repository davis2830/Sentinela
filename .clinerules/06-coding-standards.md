# Coding Standards

## Principles

- SOLID
- DRY
- KISS
- Clean Code

## Naming

Utilizar nombres descriptivos.

Evitar:

- Utils
- Helper
- Manager
- Temp

Preferir:

- MonitoringTarget
- SSLMonitor
- DNSDetector
- AlertRule

## Functions

Pequeñas.

Legibles.

Una sola responsabilidad.

## Classes

Responsabilidad única.

## Comments

Comentar únicamente cuando aporte contexto.

No comentar código obvio.

## Secrets

Nunca almacenar secretos en el código.

Usar variables de entorno.

## Tests

Toda funcionalidad importante debe incluir pruebas.