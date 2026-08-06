from rest_framework import serializers

from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    """Serializer for Report model."""

    class Meta:
        model = Report
        fields = (
            "id",
            "organization",
            "report_type",
            "title",
            "parameters",
            "status",
            "data",
            "error_message",
            "generated_at",
            "period_start",
            "period_end",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "status",
            "data",
            "error_message",
            "generated_at",
            "created_at",
            "updated_at",
        )


class ReportCreateSerializer(serializers.Serializer):
    """Serializer for report creation."""

    report_type = serializers.ChoiceField(
        choices=["sla", "availability", "ssl", "incidents", "trends", "summary"]
    )
    title = serializers.CharField(max_length=500)
    parameters = serializers.DictField(required=False, default=dict)
    period_start = serializers.DateTimeField(required=False)
    period_end = serializers.DateTimeField(required=False)