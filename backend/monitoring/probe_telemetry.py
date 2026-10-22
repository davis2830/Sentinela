"""Bounded agent-reported diagnostics, never raw logs or task contents."""
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers


class ProbeTelemetrySerializer(serializers.Serializer):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    queue = serializers.JSONField(allow_null=True)
    queue_limit = serializers.IntegerField(min_value=1, max_value=1000)
    draining = serializers.BooleanField()
    rejected_retained = serializers.IntegerField(min_value=0, max_value=1000, allow_null=True)
    last_ack_at = serializers.DateTimeField(allow_null=True)
    last_rejection_at = serializers.DateTimeField(allow_null=True)
    errors = serializers.JSONField()

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) != set(self.fields):
            raise serializers.ValidationError({'telemetry': 'Contrato de telemetría no válido.'})
        for key in ('schema_version', 'queue_limit', 'rejected_retained'):
            if data[key] is not None and type(data[key]) is not int:
                raise serializers.ValidationError({key: 'Contador no válido.'})
        if type(data['draining']) is not bool:
            raise serializers.ValidationError({'draining': 'Modo de drenaje no válido.'})
        return super().to_internal_value(data)

    def validate(self, data):
        queue = data['queue']
        if queue is not None and (not isinstance(queue, dict) or
            set(queue) != {'queued', 'running', 'ready'} or
            any(type(n) is not int or n < 0 for n in queue.values()) or
            sum(queue.values()) > data['queue_limit']):
            raise serializers.ValidationError('Cola local no válida.')
        codes = {'storage': {'local_storage'}, 'delivery': {'delivery_unconfirmed', 'receipt_incomplete'},
                 'heartbeat': {'control_unconfirmed'}}
        errors = data['errors']
        if not isinstance(errors, list) or len(errors) > 3:
            raise serializers.ValidationError('Diagnóstico no válido.')
        components = set()
        for error in errors:
            if (not isinstance(error, dict) or set(error) != {'component', 'code', 'failures'} or
                not isinstance(error['component'], str) or not isinstance(error['code'], str) or
                error['code'] not in codes.get(error['component'], set()) or
                error['component'] in components or type(error['failures']) is not int or
                not 1 <= error['failures'] <= 1000000):
                raise serializers.ValidationError('Diagnóstico no válido.')
            components.add(error['component'])
        if queue is None and 'storage' not in components:
            raise serializers.ValidationError('La cola desconocida requiere diagnóstico de almacenamiento.')
        if any(data[key] and data[key] > timezone.now()+timedelta(minutes=5)
               for key in ('last_ack_at', 'last_rejection_at')):
            raise serializers.ValidationError('Fecha de diagnóstico futura.')
        # JSON-compatible, canonical dates. Unknown keys never reach persistence.
        for key in ('last_ack_at', 'last_rejection_at'):
            data[key] = data[key].isoformat() if data[key] else None
        return data


def present_telemetry(probe):
    snapshot = probe.operational_snapshot
    fresh = bool(snapshot is not None and probe.is_online and probe.telemetry_received_at and
                 timezone.now()-probe.telemetry_received_at <= timedelta(seconds=45))
    return {'state': 'current' if fresh else 'stale' if snapshot is not None else 'unknown',
            'received_at': probe.telemetry_received_at.isoformat() if probe.telemetry_received_at else None,
            'snapshot': snapshot}
