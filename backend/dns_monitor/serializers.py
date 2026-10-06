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
            "created_at",
            "updated_at",
        )


class DNSRecordCreateSerializer(serializers.Serializer):
    """Serializer for DNS record creation."""

    domain = serializers.CharField(max_length=500)
    record_type = serializers.ChoiceField(
        choices=["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR", "CAA"]
    )


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
