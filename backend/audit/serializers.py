from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model.

    All fields are read-only since audit logs are immutable.
    """

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "organization_id",
            "user_id",
            "user_email",
            "action",
            "module",
            "result",
            "ip_address",
            "description",
            "metadata",
            "timestamp",
        )
        read_only_fields = fields