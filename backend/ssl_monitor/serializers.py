from rest_framework import serializers

from .models import SSLCertificate


class SSLCertificateSerializer(serializers.ModelSerializer):
    """Serializer for SSLCertificate model."""

    class Meta:
        model = SSLCertificate
        fields = (
            "id",
            "organization",
            "domain",
            "issuer",
            "subject",
            "expiration_date",
            "algorithm",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "issuer",
            "subject",
            "expiration_date",
            "algorithm",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "error_message",
            "created_at",
            "updated_at",
        )


class SSLCertificateCreateSerializer(serializers.Serializer):
    """Serializer for certificate creation."""

    domain = serializers.CharField(max_length=500)