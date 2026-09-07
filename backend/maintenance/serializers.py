from rest_framework import serializers

from .models import (
    MaintenanceWindow,
    MaintenanceWindowTarget,
    MaintenanceWindowUpdate,
)


class MaintenanceWindowTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceWindowTarget
        fields = ["id", "target_type", "target_id", "target_name"]


class MaintenanceWindowUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceWindowUpdate
        fields = ["id", "message", "status", "actor_name", "posted_at"]


class MaintenanceWindowSerializer(serializers.ModelSerializer):
    targets = MaintenanceWindowTargetSerializer(many=True, read_only=True)
    updates = MaintenanceWindowUpdateSerializer(many=True, read_only=True)
    responsible_team_name = serializers.CharField(
        source="responsible_team.name", read_only=True, default=None
    )
    responsible_team_color = serializers.CharField(
        source="responsible_team.color", read_only=True, default=None
    )
    status_page_name = serializers.CharField(
        source="status_page.company_name", read_only=True, default=None
    )
    status_page_slug = serializers.CharField(
        source="status_page.slug", read_only=True, default=None
    )
    status_page_maintenance_id = serializers.UUIDField(
        source="status_page_maintenance.id", read_only=True, default=None
    )
    responsible_user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(read_only=True)
    is_active_now = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceWindow
        fields = [
            "id",
            "organization_id",
            "title",
            "description",
            "status",
            "start_time",
            "end_time",
            "recurrence",
            "recurrence_day_of_week",
            "recurrence_time_start",
            "recurrence_time_end",
            "suppress_notifications",
            "exclude_from_sla",
            "publish_to_status_page",
            "status_page",
            "status_page_name",
            "status_page_slug",
            "status_page_maintenance_id",
            "responsible_team",
            "responsible_team_name",
            "responsible_team_color",
            "responsible_user",
            "responsible_user_name",
            "created_by",
            "created_by_name",
            "duration_minutes",
            "is_active_now",
            "targets",
            "updates",
            "created_at",
            "updated_at",
        ]

    def get_responsible_user_name(self, obj):
        if obj.responsible_user:
            return obj.responsible_user.get_full_name() or getattr(obj.responsible_user, "email", "")
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or getattr(obj.created_by, "email", "")
        return None

    def get_is_active_now(self, obj):
        return obj.is_currently_active()


class TargetInputSerializer(serializers.Serializer):
    target_type = serializers.CharField(required=True)
    target_id = serializers.UUIDField(required=False, allow_null=True)
    target_name = serializers.CharField(required=False, allow_blank=True, default="")


class MaintenanceWindowCreateSerializer(serializers.ModelSerializer):
    targets = TargetInputSerializer(many=True, required=False, default=list)

    class Meta:
        model = MaintenanceWindow
        fields = [
            "title",
            "description",
            "status",
            "start_time",
            "end_time",
            "recurrence",
            "recurrence_day_of_week",
            "recurrence_time_start",
            "recurrence_time_end",
            "suppress_notifications",
            "exclude_from_sla",
            "publish_to_status_page",
            "status_page",
            "responsible_team",
            "responsible_user",
            "targets",
        ]

    def validate(self, data):
        start = data.get("start_time")
        end = data.get("end_time")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "La fecha y hora de fin debe ser posterior a la fecha y hora de inicio."}
            )
        return data


class MaintenanceWindowPatchSerializer(serializers.ModelSerializer):
    targets = TargetInputSerializer(many=True, required=False)

    class Meta:
        model = MaintenanceWindow
        fields = [
            "title",
            "description",
            "status",
            "start_time",
            "end_time",
            "recurrence",
            "recurrence_day_of_week",
            "recurrence_time_start",
            "recurrence_time_end",
            "suppress_notifications",
            "exclude_from_sla",
            "publish_to_status_page",
            "status_page",
            "responsible_team",
            "responsible_user",
            "targets",
        ]

    def validate(self, data):
        instance = self.instance
        start = data.get("start_time", getattr(instance, "start_time", None))
        end = data.get("end_time", getattr(instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "La fecha y hora de fin debe ser posterior a la fecha y hora de inicio."}
            )
        return data


class MaintenanceWindowProgressUpdateSerializer(serializers.Serializer):
    message = serializers.CharField(required=True)
    status = serializers.CharField(required=False, default="in_progress")


class MaintenanceWindowBulkActionSerializer(serializers.Serializer):
    maintenance_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )
    action = serializers.ChoiceField(
        choices=["start", "complete", "cancel", "delete"]
    )
