from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import DNSChangeHistory, DNSRecord


class DNSRecordSerializer(ScanAvailabilitySerializer):
    """Serializer for DNSRecord model."""

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = DNSRecord
        fields = (
            "scan_availability",
            "id",
            "organization",
            "domain",
            "record_type",
            "value",
            "ttl",
            "response_time_ms",
            "last_scanned_at",
            "last_change_at",
            "last_attempt_status",
            "last_error_code",
            "last_error_message",
            "last_successful_at",
            "resolver",
            "expected_values",
            "matches_expected",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "value",
            "ttl",
            "response_time_ms",
            "last_scanned_at",
            "last_change_at",
            "last_attempt_status",
            "last_error_code",
            "last_error_message",
            "last_successful_at",
            "resolver",
            "expected_values",
            "matches_expected",
            "created_at",
            "updated_at",
        )


class DNSRecordCreateSerializer(serializers.Serializer):
    """Serializer for DNS record creation."""

    expected_values = serializers.ListField(
        child=serializers.CharField(max_length=2048), max_length=100, required=False
    )
    domain = serializers.CharField(max_length=500)
    record_type = serializers.ChoiceField(choices=DNSRecord.RecordType.choices)


class DNSChangeHistorySerializer(serializers.ModelSerializer):
    """Serializer for DNSChangeHistory model."""

    class Meta:
        model = DNSChangeHistory
        fields = (
            "id",
            "record",
            "old_value",
            "new_value",
            "changed_at",
        )
        read_only_fields = ("id", "record", "changed_at")
