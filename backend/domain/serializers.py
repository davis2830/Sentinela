from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import DomainInfo


class DomainInfoSerializer(ScanAvailabilitySerializer):
    """Serializer for DomainInfo model."""

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = DomainInfo
        fields = (
            "scan_availability",
            "id",
            "organization",
            "domain",
            "registrar",
            "creation_date",
            "expiration_date",
            "last_updated",
            "status",
            "name_servers",
            "registrant_country",
            "days_until_expiration",
            "is_locked",
            "whois_server",
            "dnssec",
            "last_scanned_at",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "registrar",
            "creation_date",
            "expiration_date",
            "last_updated",
            "status",
            "name_servers",
            "registrant_country",
            "days_until_expiration",
            "is_locked",
            "whois_server",
            "dnssec",
            "last_scanned_at",
            "error_message",
            "created_at",
            "updated_at",
        )


class DomainInfoCreateSerializer(serializers.Serializer):
    """Serializer for domain creation."""

    domain = serializers.CharField(max_length=500)
