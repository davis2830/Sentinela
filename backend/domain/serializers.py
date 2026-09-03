from rest_framework import serializers

from .models import DomainInfo


class DomainInfoSerializer(serializers.ModelSerializer):
    """Serializer for DomainInfo model."""

    class Meta:
        model = DomainInfo
        fields = (
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