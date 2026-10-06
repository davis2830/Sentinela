from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import SSLCertificate


class SSLCertificateSerializer(ScanAvailabilitySerializer):
    """Serializer for SSLCertificate model."""

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = SSLCertificate
        fields = (
            "scan_availability",
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

    def validate(self, attrs):
        domain = attrs.get("domain")
        port = attrs.get("port", 443)
        if domain:
            from common.security import validate_safe_public_url
            validate_safe_public_url(f"https://{domain}:{port}")
        return attrs
