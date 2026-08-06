# Backend Rules

## Folder Structure

Cada aplicación debe mantener una estructura consistente.

```
app/
│
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── services.py
├── tasks.py
├── permissions.py
├── tests/
```

## Services

Toda lógica de negocio debe implementarse en Services.

Las Views únicamente deben:

- validar
- llamar servicios
- responder

## Tasks

Todo proceso pesado debe ejecutarse mediante Celery.

Ejemplos:

- SSL Scan
- DNS Scan
- WHOIS
- Envío de correos
- Notificaciones

## Exceptions

Utilizar excepciones claras.

No devolver errores genéricos.

## Logging

Toda excepción importante debe registrarse.

Nunca ocultar errores silenciosamente.