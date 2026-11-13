"""Prevent an in-flight result from overwriting a resource edited during its measurement."""

import hashlib
import json
from contextvars import ContextVar

current = ContextVar("scan_configuration", default=None)
FIELDS = (
    "endpoint",
    "target_type",
    "runner_type",
    "agent_probe_id",
    "domain",
    "port",
    "record_type",
    "url",
    "method",
    "http_method",
    "expected_status",
    "expected_schema",
    "expected_headers",
    "request_headers",
    "request_body",
    "custom_headers",
    "max_latency_ms",
    "expected_response_time_ms",
    "enabled",
)


def fingerprint(resource):
    values = {field: getattr(resource, field) for field in FIELDS if hasattr(resource, field)}
    return hashlib.sha256(json.dumps(values, sort_keys=True, default=str).encode()).hexdigest()


class ConfigurationChanged(Exception):
    pass


def matches(resource):
    previous = current.get()
    return not previous or previous[0] != str(resource.pk) or previous[1] == fingerprint(resource)


def assert_current(resource):
    if not matches(resource):
        raise ConfigurationChanged(
            "La configuración cambió durante la medición; el resultado no reemplaza el estado actual."
        )
