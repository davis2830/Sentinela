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
            "port",
            "issuer",
            "subject",
            "issued_at",
            "expiration_date",
            "security_grade",
            "algorithm",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "error_message",
            "san_domains",
            "tls_version",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "issuer",
            "subject",
            "issued_at",
            "expiration_date",
            "security_grade",
            "algorithm",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "error_message",
            "san_domains",
            "tls_version",
            "created_at",
            "updated_at",
        )


class SSLCertificateCreateSerializer(serializers.Serializer):
    """Serializer for certificate creation."""

    domain = serializers.CharField(max_length=500)
    port = serializers.IntegerField(default=443, required=False)