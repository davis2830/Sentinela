import math
from rest_framework import serializers


class AgentResultSerializer(serializers.Serializer):
    target_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=('up', 'slow', 'down', 'error'))
    response_time_ms = serializers.FloatField(min_value=0)
    http_status = serializers.IntegerField(min_value=0, max_value=599, required=False, allow_null=True)
    error_message = serializers.CharField(max_length=4096, required=False, allow_blank=True, default='')

    def validate_http_status(self, value):
        # Existing Sentinine uses 0 for TCP/DNS and HTTP transport failures.
        if value is not None and value != 0 and value < 100:
            raise serializers.ValidationError('Usa un código HTTP válido o 0 cuando no haya respuesta HTTP.')
        return value

    def validate_response_time_ms(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError('La latencia debe ser finita y no negativa.')
        return value


def validated_results(results):
    if not isinstance(results, list) or len(results) > 10000:
        raise serializers.ValidationError('Envía una lista de hasta 10000 resultados.')
    serializer = AgentResultSerializer(data=results, many=True)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data
