# API Design

Todas las APIs serán REST.

## Versionado

/api/v1/

---

## Formato

Success

{
    "success": true,
    "data": {}
}

Error

{
    "success": false,
    "message": "...",
    "errors": []
}

---

## Authentication

JWT

OAuth2

---

## Documentation

Toda API deberá documentarse mediante OpenAPI.

---

## Naming

Utilizar nombres consistentes.

Ejemplo

/organizations/

/monitoring-targets/

/ssl-certificates/

/alerts/