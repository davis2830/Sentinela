import json
import re

from django.core.management.base import BaseCommand
from django.db import connection
from django.urls import URLPattern, get_resolver
from common.contracts import ERROR, describe


def operations(patterns, prefix=""):
    for pattern in patterns:
        route = prefix + str(pattern.pattern)
        if not isinstance(pattern, URLPattern):
            yield from operations(pattern.url_patterns, route)
            continue
        if not route.startswith(("api/v1/", "health/")):
            continue
        callback = pattern.callback
        view = getattr(callback, "cls", getattr(callback, "view_class", None))
        if view is None:
            continue
        actions = getattr(callback, "actions", None) or {}
        methods = actions or {
            method: method for method in view.http_method_names
            if method not in {"head", "options", "trace"} and hasattr(view, method)
        }
        parameters = [
            {"name": name, "in": "path", "required": True, "schema": {"type": "string"}}
            for name in re.findall(r"<(?:\w+:)?(\w+)>", route)
        ]
        route = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", route)
        for method, action in methods.items():
            contract = describe(view, action)
            yield "/" + route, method, {
                "summary": f"{view.__name__}.{action}",
                "parameters": parameters + contract.pop("parameters"),
                "x-handler": f"{view.__module__}.{view.__name__}.{action}",
                "x-permission-classes": [cls.__name__ for cls in getattr(view, "permission_classes", ())],
                "x-authentication-classes": [cls.__name__ for cls in getattr(view, "authentication_classes", ())],
                **contract,
            }


class Command(BaseCommand):
    help = "Exporta el inventario de API o el esquema físico de la base conectada."

    def add_arguments(self, parser):
        parser.add_argument("kind", choices=["api", "database"])

    def handle(self, *args, **options):
        if options["kind"] == "api":
            paths = {}
            for route, method, operation in operations(get_resolver().url_patterns):
                paths.setdefault(route, {})[method] = operation
            result = {
                "openapi": "3.0.3",
                "info": {
                    "title": "Sentinel — contratos de API",
                    "version": "1",
                    "description": "Rutas, parámetros, serializers y errores HTTP. Los campos de JSON dinámico permanecen desconocidos y requieren validación en ejecución.",
                },
                "paths": paths,
                "components": {"responses": {"ApiError": ERROR, "LimitedError": {**ERROR, "headers": {"Retry-After": {"schema": {"type": "string"}, "description": "Segundos antes del próximo intento."}}}}},
            }
        else:
            result = {}
            with connection.cursor() as cursor:
                for table in sorted(connection.introspection.table_names(cursor)):
                    cursor.execute(
                        """
                        SELECT attname, pg_catalog.format_type(atttypid, atttypmod)
                        FROM pg_catalog.pg_attribute
                        WHERE attrelid = pg_catalog.to_regclass(%s)
                          AND attnum > 0 AND NOT attisdropped
                        """,
                        [connection.ops.quote_name(table)],
                    )
                    physical_types = dict(cursor.fetchall())
                    result[table] = {
                        "columns": [
                            {**column._asdict(), "postgres_type": physical_types[column.name]}
                            for column in connection.introspection.get_table_description(cursor, table)
                        ],
                        "constraints": connection.introspection.get_constraints(cursor, table),
                    }
        self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True, default=str))
