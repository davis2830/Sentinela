from rest_framework import serializers

from .models import DNSChangeHistory, DNSRecord


class DNSRecordSerializer(serializers.ModelSerializer):
    """Serializer for DNSRecord model."""

    class Meta:
        model = DNSRecord
        fields = (
            "id",
            "organization",
            "domain",
            "record_type",
            "value",
            "ttl",
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
            "last_scanned_at",
            "last_change_at",
            "created_at",
            "updated_at",
        )


class DNSRecordCreateSerializer(serializers.Serializer):
    """Serializer for DNS record creation."""

    domain = serializers.CharField(max_length=500)
    record_type = serializers.ChoiceField(
        choices=["A", "AAAA", "MX", "TXT", "NS", "CNAME"]
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