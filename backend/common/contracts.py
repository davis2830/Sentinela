"""Serializer-backed OpenAPI contracts; dynamic JSON stays explicitly unknown."""

import ast
import inspect

from rest_framework import serializers


JSON = {"type": "object", "additionalProperties": True}
ERROR = {
    "description": "Error HTTP o de dominio; los fallos internos nunca exponen excepciones.",
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "message": {"type": "string"},
                    "detail": {},
                    "errors": {},
                },
                "additionalProperties": True,
            }
        }
    },
}

STRING = {"type": "string"}
STRINGS = {"type": "array", "items": STRING}
PERMISSION = {
    "type": "object",
    "properties": {"code": STRING, "name": STRING, "module": STRING},
    "required": ["code", "name", "module"],
}
ACCESS = {
    "type": "object",
    "properties": {
        "authorization_mode": {"type": "string", "enum": ["legacy", "custom"]},
        "effective_permissions": STRINGS,
        "custom_permissions": STRINGS,
        "role_ids": STRINGS,
    },
    "required": ["authorization_mode", "effective_permissions", "role_ids"],
}
DIRECTORY_META = {
    "type": "object",
    "properties": {
        **{name: {"type": "integer"} for name in ("page", "page_size", "total", "total_pages")},
        "has_next": {"type": "boolean"},
        "counts": {
            "type": "object",
            "properties": {name: {"type": "integer"} for name in ("active", "pending", "revoked")},
            "required": ["active", "pending", "revoked"],
        },
    },
    "required": ["page", "page_size", "total", "total_pages", "has_next"],
}
MEMBER = {
    "type": "object",
    "properties": {
        **{
            name: STRING
            for name in (
                "id",
                "email",
                "first_name",
                "last_name",
                "role",
                "status_code",
                "status_label",
                "authorization_mode",
            )
        },
        "date_joined": {"type": "string", "nullable": True},
        "last_login": {"type": "string", "nullable": True},
        "is_active": {"type": "boolean"},
        "is_invitation": {"type": "boolean"},
        "teams": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": STRING, "name": STRING, "color": STRING},
                "required": ["id", "name", "color"],
            },
        },
    },
    "required": [
        "id",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "status_code",
        "status_label",
        "is_invitation",
        "date_joined",
        "teams",
    ],
}
MEMBER["properties"]["status_code"] = {"type": "string", "enum": ["active", "pending", "revoked"]}
MEMBER["properties"]["authorization_mode"] = {"type": "string", "enum": ["legacy", "custom"]}


def explicit_output(view, action):
    declared = getattr(view, "output_serializer", None)
    if isinstance(declared, dict):
        declared = declared.get(action)
    if declared:
        schema = serializer_schema(declared())
        return {"type": "array", "items": schema} if getattr(view, "output_many", False) else schema
    name = view.__name__
    connectivity = {
        "MonitoringTargetListView": ("monitoring.serializers", "MonitoringTargetSerializer"),
        "SSLCertificateListView": ("ssl_monitor.serializers", "SSLCertificateSerializer"),
        "DNSRecordListView": ("dns_monitor.serializers", "DNSRecordSerializer"),
        "DomainListView": ("domain.serializers", "DomainInfoSerializer"),
        "APICheckTargetListView": ("api_checks.serializers", "APICheckTargetSerializer"),
        "SecurityHeaderTargetListView": ("security_headers.serializers", "SecurityHeaderTargetSerializer"),
        "AgentProbeListView": ("monitoring.serializers", "AgentProbeSerializer"),
    }
    if name in connectivity and action == "get":
        from importlib import import_module

        module, serializer = connectivity[name]
        return {"type": "array", "items": serializer_schema(getattr(import_module(module), serializer)())}
    if name == "ScanExecutionView":
        return {
            "type": "object",
            "properties": {
                "id": STRING,
                "state": {"type": "string", "enum": ["queued", "running", "completed", "failed", "expired"]},
                "origin": {"type": "string", "enum": ["cloud", "agent"]},
                "submitted_at": STRING,
                "started_at": {"type": "string", "nullable": True},
                "finished_at": {"type": "string", "nullable": True},
                "error_code": STRING,
            },
        }
    if name == "AuthorizationCatalogView":
        return {"type": "array", "items": PERMISSION}
    if name == "UserAuthorizationView":
        return ACCESS
    if name == "OrganizationMembersView" and action == "get":
        return {"type": "array", "items": MEMBER}
    if name == "PlanCatalogView":
        return {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    **{key: STRING for key in ("id", "tier", "name", "price", "period")},
                    "price_monthly_usd": {"type": "number"},
                    "features": STRINGS,
                    "notIncluded": STRINGS,
                    "beta": {"type": "boolean"},
                    "limits": JSON,
                },
                "required": [
                    "id",
                    "tier",
                    "name",
                    "price",
                    "period",
                    "price_monthly_usd",
                    "features",
                    "notIncluded",
                    "beta",
                    "limits",
                ],
            },
        }
    return None


def field_schema(field, *, request=False):
    schema = non_nullable_field_schema(field, request=request)
    if schema and field.allow_null:
        return {**schema, "nullable": True}
    return schema


def non_nullable_field_schema(field, *, request=False):
    if isinstance(field, serializers.ListSerializer):
        return {"type": "array", "items": serializer_schema(field.child, request=request)}
    if isinstance(field, serializers.BaseSerializer):
        return serializer_schema(field, request=request)
    if isinstance(field, serializers.ManyRelatedField):
        return {"type": "array", "items": field_schema(field.child_relation, request=request)}
    if isinstance(field, serializers.ListField):
        return {"type": "array", "items": field_schema(field.child, request=request)}
    if isinstance(field, serializers.BooleanField):
        return {"type": "boolean"}
    if isinstance(field, serializers.IntegerField):
        return {"type": "integer"}
    if isinstance(field, serializers.DecimalField):
        from rest_framework.settings import api_settings

        if request:
            return {"oneOf": [{"type": "number"}, {"type": "string"}]}
        return {
            "type": "string" if getattr(field, "coerce_to_string", api_settings.COERCE_DECIMAL_TO_STRING) else "number"
        }
    if isinstance(field, serializers.FloatField):
        return {"type": "number"}
    if isinstance(field, serializers.ChoiceField):
        return {"type": "string", "enum": [str(v) for v in field.choices]}
    if isinstance(field, serializers.JSONField):
        return {}
    if isinstance(field, serializers.DictField):
        return {"type": "object", "additionalProperties": field_schema(field.child, request=request)}
    if isinstance(field, serializers.SerializerMethodField):
        return {}  # Runtime-shaped values require consumer-side validation.
    if not isinstance(
        field,
        (
            serializers.CharField,
            serializers.UUIDField,
            serializers.DateField,
            serializers.DateTimeField,
            serializers.TimeField,
            serializers.DurationField,
            serializers.PrimaryKeyRelatedField,
            serializers.SlugRelatedField,
        ),
    ):
        return {}
    result = {"type": "string"}
    if isinstance(field, serializers.UUIDField):
        result["format"] = "uuid"
    if isinstance(field, serializers.DateTimeField):
        result["format"] = "date-time"
    if field.allow_null:
        result["nullable"] = True
    return result


def serializer_schema(serializer, *, request=False):
    fields = serializer.fields
    properties = {
        name: field_schema(field, request=request)
        for name, field in fields.items()
        if not (request and field.read_only or not request and field.write_only)
    }
    required = [name for name, field in fields.items() if name in properties and field.required]
    result = {"type": "object", "properties": properties}
    if required:
        result["required"] = required
    return result


def describe(view, action):
    method = getattr(view, action)
    source = inspect.getsource(method)
    tree = ast.parse("class Inspected:\n" + source if source[0].isspace() else source)
    module = inspect.getmodule(method)
    inputs, outputs, parameters = [], [], {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == "query_params"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ):
            name = node.args[0].value
            if isinstance(name, str):
                parameters[name] = {
                    "name": name,
                    "in": "query",
                    "schema": {"type": "integer" if name in ("page", "page_size", "limit", "days") else "string"},
                }
        if not isinstance(node.func, ast.Name):
            continue
        cls = getattr(module, node.func.id, None)
        if not isinstance(cls, type) or not issubclass(cls, serializers.BaseSerializer):
            continue
        request = any(k.arg == "data" for k in node.keywords)
        try:
            schema = serializer_schema(cls(), request=request)
        except (AttributeError, TypeError, AssertionError):
            continue
        if not request and any(
            k.arg == "many" and isinstance(k.value, ast.Constant) and k.value.value for k in node.keywords
        ):
            schema = {"type": "array", "items": schema}
        (inputs if request else outputs).append(schema)
    declared_input = getattr(view, "input_serializer", None)
    if declared_input and action in ("post", "put", "patch"):
        inputs.append(serializer_schema(declared_input(), request=True))
    declared_query = getattr(view, "query_serializer", None)
    if declared_query and action == "get":
        for name, field in declared_query().fields.items():
            parameters[name] = {
                "name": name,
                "in": "query",
                "required": field.required,
                "schema": field_schema(field, request=True),
            }
    operation = {
        "parameters": list(parameters.values()),
        "responses": {
            str(code): {"$ref": "#/components/responses/ApiError"} for code in (400, 401, 403, 404, 409, 429, 500)
        },
    }
    operation["responses"]["429"] = {"$ref": "#/components/responses/LimitedError"}
    output = explicit_output(view, action) or (outputs[-1] if outputs else {})
    if view.__name__ == "OrganizationInvoicesView":
        output = {"type": "array", "items": {}}
    envelope = {
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "data": output,
            "message": {"type": "string"},
            "meta": JSON.copy(),
        },
        "required": ["success", "data"],
    }
    if getattr(view, "meta_serializer", None):
        envelope["properties"]["meta"] = serializer_schema(view.meta_serializer())
    connectivity_directories = {
        "MonitoringTargetListView",
        "SSLCertificateListView",
        "DNSRecordListView",
        "DomainListView",
        "APICheckTargetListView",
        "SecurityHeaderTargetListView",
        "AgentProbeListView",
    }
    if view.__name__ in connectivity_directories and action == "get":
        envelope["properties"]["meta"] = DIRECTORY_META
        operation["parameters"] += [
            {
                "name": name,
                "in": "query",
                "schema": {"type": "integer", "minimum": 1} if name == "page" else STRING,
                "description": "page activa páginas de 25. export=csv exporta todos los resultados filtrados sin límite de página.",
            }
            for name in (
                "page",
                "search",
                "status",
                "method",
                "type",
                "grade",
                "lifecycle",
                "ordering",
                "tag",
                "export",
            )
            if name not in parameters
        ]
        operation["responses"]["200"] = {
            "description": "Datos compatibles o CSV filtrado",
            "content": {"text/csv": {"schema": STRING}},
        }
    if view.__name__ in ("UserListView", "OrganizationMembersView") and action == "get":
        envelope["properties"]["meta"] = DIRECTORY_META
    if view.__name__ == "OrganizationInvoicesView":
        envelope["properties"]["meta"] = {
            "type": "object",
            "properties": {"billing_available": {"type": "boolean", "enum": [False]}},
            "required": ["billing_available"],
        }
    operation["responses"]["200"] = {
        "description": "Respuesta del endpoint (datos dinámicos desconocidos requieren validación).",
        "content": {"application/json": {"schema": envelope}},
    }
    if view.__name__ in connectivity_directories and action == "get":
        operation["responses"]["200"]["content"]["text/csv"] = {"schema": STRING}
    if action == "post":
        operation["responses"]["201"] = operation["responses"]["200"]
        operation["requestBody"] = {
            "required": True,
            "content": {"application/json": {"schema": inputs[-1] if inputs else JSON.copy()}},
        }
    elif action in ("put", "patch", "delete"):
        operation["requestBody"] = {"content": {"application/json": {"schema": inputs[-1] if inputs else JSON.copy()}}}
    if "ScanView" in view.__name__ or "BulkScan" in view.__name__:
        operation["responses"]["202"] = {
            "description": "Escaneo aceptado, nunca un recurso obsoleto.",
            "content": {"application/json": {"schema": envelope}},
        }
    if view.__name__ in ("UserListView", "OrganizationMembersView"):
        operation["parameters"] += [
            {
                "name": name,
                "in": "query",
                "schema": {"type": "integer" if name == "page" else "string"},
                "description": "page activa páginas de 25; sin page se conserva el formato anterior.",
            }
            for name in ("page", "search", "role", "status", "team")
            if name not in parameters
        ]
    return operation
