from django.test import SimpleTestCase
from rest_framework import serializers

from common.contracts import serializer_schema


class ContractSchemaTests(SimpleTestCase):
    def test_relation_arrays_and_dynamic_json_are_not_described_as_scalar_strings(self):
        class Example(serializers.Serializer):
            identities = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
            payload = serializers.JSONField()
            computed = serializers.ReadOnlyField()
            latency = serializers.FloatField(allow_null=True)
            amount = serializers.DecimalField(max_digits=8, decimal_places=2)

        schema = serializer_schema(Example())
        self.assertEqual(schema["properties"]["identities"]["type"], "array")
        # A JSONField can contain an array and a computed property can be boolean.
        # Unknown schemas preserve this instead of promising the wrong scalar type.
        self.assertEqual(schema["properties"]["payload"], {})
        self.assertEqual(schema["properties"]["computed"], {})
        self.assertTrue(schema["properties"]["latency"]["nullable"])
        actual = Example().fields["amount"].to_representation("12.50")
        self.assertEqual(schema["properties"]["amount"]["type"], "string" if isinstance(actual, str) else "number")
