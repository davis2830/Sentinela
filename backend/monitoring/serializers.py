from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import AgentProbe, MaintenanceWindow, MonitoringCheck, MonitoringTarget


def validate_agent_binding(runner_type, probe_id, request):
    if probe_id and runner_type != 'agent':
        raise serializers.ValidationError({'agent_probe':'El agente requiere runner_type=agent.'})
    if runner_type == 'agent' and request is not None:
        org_id = getattr(getattr(request,'user',None),'organization_id',None)
        if not probe_id or not AgentProbe.objects.filter(pk=probe_id,organization_id=org_id).exists():
            raise serializers.ValidationError({'agent_probe':'Selecciona un agente de tu organización.'})


def validate_agent_dns(endpoint):
    import ipaddress
    from urllib.parse import urlsplit
    parsed = urlsplit(endpoint if '://' in endpoint else '//'+endpoint)
    if parsed.port is not None:
        raise serializers.ValidationError({'endpoint':'DNS resuelve un nombre; un puerto no selecciona el servidor DNS.'})
    try:
        ipaddress.ip_address(parsed.hostname or '')
    except ValueError:
        return
    raise serializers.ValidationError({'endpoint':'DNS requiere hostname; una IP literal no comprueba resolución.'})


class AgentProbeSerializer(serializers.ModelSerializer):
    """Serializer for AgentProbe private satellite runners."""

    is_online = serializers.BooleanField(read_only=True)
    assigned_targets_count = serializers.SerializerMethodField()
    delivery = serializers.SerializerMethodField()
    telemetry = serializers.SerializerMethodField()

    class Meta:
        model = AgentProbe
        fields = (
            "id",
            "name",
            "status",
            "is_online",
            "last_heartbeat",
            "ip_address",
            "hostname",
            "version",
            "os_info",
            "assigned_targets_count",
            "delivery",
            "telemetry",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "is_online",
            "last_heartbeat",
            "ip_address",
            "hostname",
            "version",
            "os_info",
            "assigned_targets_count",
            "created_at",
            "updated_at",
        )

    def get_assigned_targets_count(self, obj):
        return obj.assigned_targets.count()

    def get_telemetry(self, obj):
        from .probe_telemetry import present_telemetry
        return present_telemetry(obj)

    def get_delivery(self, obj):
        from datetime import timedelta
        from django.db.models import Count, Max, Q
        from django.utils import timezone
        from .models import AgentExecution

        # Only server receipts are authoritative; never infer local queue health.
        summary = AgentExecution.objects.filter(
            probe_id=obj.pk, organization_id=obj.organization_id,
        ).aggregate(
            pending=Count('id', filter=Q(accepted_at__isnull=True)),
            overdue=Count('id', filter=Q(accepted_at__isnull=True, created_at__lte=timezone.now()-timedelta(minutes=10))),
            last_received=Max('accepted_at'),
        )
        state = ('offline' if not obj.is_online else
                 'overdue' if summary['overdue'] else
                 'pending' if summary['pending'] else
                 'received' if summary['last_received'] else 'unknown')
        return {
            'state': state, 'pending': summary['pending'], 'overdue': summary['overdue'],
            'last_received_at': serializers.DateTimeField().to_representation(summary['last_received'])
            if summary['last_received'] else None,
            'source': 'server_execution_ledger',
        }


class AgentProbeCreateSerializer(serializers.Serializer):
    """Serializer for registering a new AgentProbe."""

    name = serializers.CharField(max_length=150)


class MonitoringTargetSerializer(ScanAvailabilitySerializer):
    """Serializer for MonitoringTarget model."""

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = MonitoringTarget
        fields = (
            "scan_availability",
            "id",
            "organization",
            "name",
            "target_type",
            "endpoint",
            "interval",
            "enabled",
            "http_method",
            "expected_status",
            "custom_headers",
            "request_body",
            "max_latency_ms",
            "last_checked_at",
            "last_status",
            "last_latency",
            "tags",
            "owner_team",
            "owner_team_name",
            "owner_team_color",
            "runner_type",
            "agent_probe",
            "agent_probe_name",
            "agent_probe_status",
            "agent_probe_online",
            "recent_checks",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "last_latency",
            "owner_team_name",
            "owner_team_color",
            "agent_probe_name",
            "agent_probe_status",
            "agent_probe_online",
            "recent_checks",
            "created_at",
            "updated_at",
        )

    recent_checks = serializers.SerializerMethodField()
    owner_team_name = serializers.CharField(source="owner_team.name", read_only=True, allow_null=True)
    owner_team_color = serializers.CharField(source="owner_team.color", read_only=True, allow_null=True)
    agent_probe_name = serializers.CharField(source="agent_probe.name", read_only=True, allow_null=True)
    agent_probe_status = serializers.CharField(source="agent_probe.status", read_only=True, allow_null=True)
    agent_probe_online = serializers.BooleanField(source="agent_probe.is_online", read_only=True, allow_null=True)

    def get_recent_checks(self, obj):
        from .presentation import check_presentation
        if hasattr(obj, "prefetched_recent_checks"):
            checks = obj.prefetched_recent_checks[:20]
        else:
            checks = obj.checks.order_by("-checked_at")[:20]
        return [
            {
                "status": c.status,
                "latency": c.latency,
                "checked_at": c.checked_at.isoformat(),
                **check_presentation(c),
            }
            for c in reversed(checks)
        ]


class MonitoringTargetCreateSerializer(serializers.Serializer):
    """Serializer for target creation."""

    name = serializers.CharField(max_length=255)
    related_modules = serializers.ListField(
        child=serializers.ChoiceField(choices=["ssl", "dns", "domain", "security", "api"]),
        required=False,
    )
    target_type = serializers.ChoiceField(
        choices=["http", "https", "tcp", "dns", "api", "ssl"]
    )
    endpoint = serializers.CharField(max_length=500)
    interval = serializers.IntegerField(min_value=10, required=False)
    enabled = serializers.BooleanField(default=True)
    http_method = serializers.CharField(max_length=10, required=False, default="GET")
    expected_status = serializers.IntegerField(required=False, default=200)
    custom_headers = serializers.JSONField(required=False, default=dict)
    request_body = serializers.CharField(required=False, default="", allow_blank=True)
    max_latency_ms = serializers.IntegerField(min_value=1, required=False, default=2000)
    tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    owner_team = serializers.UUIDField(required=False, allow_null=True)
    runner_type = serializers.ChoiceField(choices=["cloud", "agent"], required=False, default="cloud")
    agent_probe = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if "interval" not in attrs:
            request = self.context.get("request")
            organization = getattr(getattr(request, "user", None), "organization", None)
            attrs["interval"] = organization.get_plan_limits()["min_check_interval_seconds"] if organization else 300
        endpoint = attrs.get("endpoint")
        runner_type = attrs.get("runner_type", "cloud")
        agent_probe = attrs.get("agent_probe")

        # Allow private IP ranges only if executed via an on-premise Sentinine agent probe
        allow_private = runner_type == 'agent'
        validate_agent_binding(runner_type, agent_probe, self.context.get('request'))

        if endpoint:
            from common.security import validate_safe_target_endpoint, validate_agent_target_endpoint
            attrs['endpoint'] = validate_agent_target_endpoint(endpoint) if allow_private else validate_safe_target_endpoint(endpoint)
            if allow_private and attrs['target_type']=='dns':
                validate_agent_dns(attrs['endpoint'])

        from .discovery import coverage
        endpoint = attrs.get('endpoint',endpoint)
        requested = attrs.get("related_modules")
        selected, _, _, _ = coverage(attrs["target_type"], endpoint, "agent" if allow_private else "cloud", requested)
        if requested is not None and set(requested) != selected:
            raise serializers.ValidationError({"related_modules": "Cobertura incompatible con el protocolo, host o ejecución Sentinine."})

        return attrs


class MonitoringTargetUpdateSerializer(serializers.Serializer):
    """Serializer for target updates."""

    name = serializers.CharField(max_length=255, required=False)
    target_type = serializers.ChoiceField(
        choices=["http", "https", "tcp", "dns", "api", "ssl"], required=False
    )
    endpoint = serializers.CharField(max_length=500, required=False)
    interval = serializers.IntegerField(min_value=10, required=False)
    enabled = serializers.BooleanField(required=False)
    http_method = serializers.CharField(max_length=10, required=False)
    expected_status = serializers.IntegerField(required=False)
    custom_headers = serializers.JSONField(required=False)
    request_body = serializers.CharField(required=False, allow_blank=True)
    max_latency_ms = serializers.IntegerField(min_value=1, required=False)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    owner_team = serializers.UUIDField(required=False, allow_null=True)
    runner_type = serializers.ChoiceField(choices=["cloud", "agent"], required=False)
    agent_probe = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        endpoint = attrs.get("endpoint")
        current = self.context.get('target')
        runner_type = attrs.get("runner_type", getattr(current,'runner_type',None))
        agent_probe = attrs.get("agent_probe", getattr(current,'agent_probe_id',None))

        # Check if target update allows private IPs based on runner or probe
        allow_private = runner_type == 'agent'

        # Revalidate the effective destination when changing runner as well.
        if endpoint or 'runner_type' in attrs or 'agent_probe' in attrs or 'target_type' in attrs:
            validate_agent_binding(runner_type, agent_probe, self.context.get('request'))
            from common.security import validate_safe_target_endpoint, validate_agent_target_endpoint
            effective = endpoint or getattr(current,'endpoint',None)
            if effective:
                attrs['endpoint'] = validate_agent_target_endpoint(effective) if allow_private else validate_safe_target_endpoint(effective)
                if allow_private and attrs.get('target_type',getattr(current,'target_type',None))=='dns':
                    validate_agent_dns(attrs['endpoint'])

        return attrs


class MonitoringCheckSerializer(serializers.ModelSerializer):
    """Serializer for MonitoringCheck model."""

    diagnostic = serializers.SerializerMethodField()
    applied_max_latency_ms = serializers.SerializerMethodField()

    def get_diagnostic(self, obj):
        from .presentation import check_presentation
        return check_presentation(obj)['diagnostic']

    def get_applied_max_latency_ms(self, obj):
        from .presentation import check_presentation
        return check_presentation(obj)['applied_max_latency_ms']

    class Meta:
        model = MonitoringCheck
        fields = (
            "id",
            "target",
            "status",
            "latency",
            "checked_at",
            "details",
            "diagnostic",
            "applied_max_latency_ms",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")


class MaintenanceWindowSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceWindow model."""

    class Meta:
        model = MaintenanceWindow
        fields = (
            "id",
            "target",
            "name",
            "start_time",
            "end_time",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "target", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and "target" in self.initial_data:
            if str(self.initial_data["target"]) != str(self.instance.target_id):
                raise serializers.ValidationError({"target": "El objetivo de un mantenimiento no puede cambiarse."})
        return attrs
