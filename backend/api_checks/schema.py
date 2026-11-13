"""Small, explicit flat response contracts. Never retain response values/secrets."""

from rest_framework import serializers

TYPES = {"string": str, "integer": int, "float": (int, float), "boolean": bool, "list": list, "dict": dict}


def validate_contract(value):
    if not isinstance(value, dict) or any(
        not isinstance(k, str) or not k or not isinstance(v, str) or v not in TYPES for k, v in value.items()
    ):
        raise serializers.ValidationError(
            "Usa campos y tipos: string, integer, float, boolean, list o dict. No se admiten esquemas anidados."
        )
    return value


def differences(body, contract):
    if not isinstance(body, dict):
        return [{"field": "$", "expected": "dict", "received": "non_object", "code": "INVALID_JSON_OBJECT"}]
    result = []
    for field, expected in contract.items():
        supported = isinstance(expected, str) and expected in TYPES
        actual = body.get(field)
        matches = supported and field in body and isinstance(actual, TYPES[expected])
        if expected in ("integer", "float") and isinstance(actual, bool):
            matches = False
        if not matches:
            result.append(
                {
                    "field": field,
                    "expected": expected if supported else "unsupported",
                    "received": type(actual).__name__ if field in body else "missing",
                    "code": "TYPE_MISMATCH" if supported else "UNSUPPORTED_TYPE",
                }
            )
    return result
