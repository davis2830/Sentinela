# Development Guidelines

## Objective

Construir Sentinel siguiendo principios de ingeniería de software modernos, priorizando mantenibilidad, escalabilidad y calidad del código.

---

# Design Principles

Todo desarrollo debe seguir los siguientes principios.

## SOLID

Aplicar los cinco principios SOLID siempre que aporten claridad y mantenibilidad.

### Single Responsibility Principle (SRP)

Cada clase debe tener una única responsabilidad.

Ejemplo:

❌ Un MonitoringService que monitorea, envía correos y guarda registros.

✅

- MonitoringService
- NotificationService
- AuditService

---

### Open / Closed Principle (OCP)

Las clases deben estar abiertas para extensión pero cerradas para modificación.

Preferir interfaces y composición.

Evitar modificar código existente para agregar nuevas funcionalidades.

---

### Liskov Substitution Principle (LSP)

Las implementaciones deben poder sustituirse sin modificar el comportamiento esperado.

---

### Interface Segregation Principle (ISP)

Crear interfaces pequeñas.

No obligar una clase a implementar métodos que nunca utilizará.

---

### Dependency Inversion Principle (DIP)

Depender de abstracciones y no de implementaciones concretas.

---

# Clean Code

Siempre escribir código que sea:

- legible
- simple
- mantenible
- consistente

Preferir nombres descriptivos.

Evitar abreviaturas innecesarias.

---

# DRY

No duplicar lógica.

Extraer comportamiento común cuando realmente exista reutilización.

---

# KISS

Elegir siempre la solución más simple que resuelva correctamente el problema.

---

# YAGNI

No desarrollar funcionalidades que aún no son necesarias.

Diseñar para crecer, pero implementar únicamente lo requerido por la fase actual.

---

# Separation of Concerns

Separar claramente:

- UI
- API
- Dominio
- Persistencia
- Infraestructura

Nunca mezclar responsabilidades.

---

# Service Layer

Toda lógica del negocio deberá implementarse mediante Services.

Las Views únicamente coordinan peticiones.

---

# Repository Pattern

Utilizar Repository Pattern únicamente cuando aporte valor.

No introducir complejidad innecesaria.

---

# Dependency Injection

Utilizar Dependency Injection cuando existan múltiples implementaciones posibles.

No utilizar Singletons.

---

# Error Handling

Nunca ocultar excepciones.

Registrar errores importantes.

Retornar mensajes claros al usuario.

---

# Logging

Toda operación crítica deberá generar logs.

Ejemplos:

- Login
- Creación de organizaciones
- Ejecución de runbooks
- Alertas
- Automatizaciones

---

# Documentation

Todo módulo deberá incluir:

- descripción
- responsabilidades
- dependencias
- ejemplos cuando sea necesario

---

# Testing

Toda funcionalidad importante deberá incluir pruebas.

Priorizar:

- Services
- API
- Reglas de negocio

---

# Performance

No optimizar prematuramente.

Primero escribir código correcto.

Luego medir.

Finalmente optimizar.

---

# Future Mindset

Cada implementación debe preguntarse:

¿Podrá reutilizarse en las siguientes fases?

Si la respuesta es no, reconsiderar el diseño.