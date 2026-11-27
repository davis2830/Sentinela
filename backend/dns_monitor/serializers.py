from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import DNSChangeHistory, DNSRecord


class DNSRecordSerializer(ScanAvailabilitySerializer):
    """Serializer for DNSRecord model."""

    latest_change = serializers.SerializerMethodField()
    changes_last_hour = serializers.SerializerMethodField()
    linked_targets = serializers.SerializerMethodField()
    suggested_targets = serializers.SerializerMethodField()
    alert_summary = serializers.SerializerMethodField()

    def get_alert_summary(self, instance):
        from alerts.models import AlertRule
        from common.alert_summary import get_target_alert_summary

        return get_target_alert_summary(instance, AlertRule.TargetType.DNS, self.context)

    def get_latest_change(self, instance):
        cache = getattr(instance, "_prefetched_objects_cache", {})
        if "change_history" in cache:
            prefetched = list(cache["change_history"])
            latest = prefetched[0] if prefetched else None
        else:
            latest = instance.change_history.first()
        if not latest:
            return None
        return {
            "id": str(latest.pk),
            "old_value": latest.old_value,
            "new_value": latest.new_value,
            "changed_at": latest.changed_at.isoformat() if latest.changed_at else None,
        }

    def get_changes_last_hour(self, instance):
        from datetime import timedelta
        from django.utils import timezone

        since = timezone.now() - timedelta(hours=1)
        cache = getattr(instance, "_prefetched_objects_cache", {})
        if "change_history" in cache:
            return sum(
                1 for item in cache["change_history"]
                if item.changed_at and item.changed_at >= since
            )
        return instance.change_history.filter(changed_at__gte=since).count()

    def get_linked_targets(self, instance):
        linked_cache = self.context.setdefault("_dns_linked_targets", {})
        key = str(instance.pk)
        if key in linked_cache:
            return linked_cache[key]

        prefetched = getattr(instance, "_prefetched_objects_cache", {})
        if "targetcoverage_set" in prefetched or "targetcoverage" in prefetched:
            coverages = instance.targetcoverage_set.all()
        else:
            from monitoring.models import TargetCoverage

            coverages = TargetCoverage.objects.filter(
                dns=instance,
                target__organization_id=instance.organization_id,
            ).select_related("target")
        result = []
        seen = set()
        for cov in coverages:
            target = getattr(cov, "target", None)
            if target is not None and target.organization_id == instance.organization_id and target.pk not in seen:
                seen.add(target.pk)
                result.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "endpoint": target.endpoint,
                        "enabled": bool(target.enabled),
                    }
                )
        linked_cache[key] = result
        return result

    def get_suggested_targets(self, instance):
        linked = self.get_linked_targets(instance)
        linked_ids = {t["id"] for t in linked}
        only_paused_linked = bool(linked) and all(not t.get("enabled", True) for t in linked)
        if linked and not only_paused_linked:
            return []
        from monitoring.models import MonitoringTarget
        from monitoring.coverage import matches

        cache = self.context.setdefault("_dns_org_targets", {})
        org_id = instance.organization_id
        if org_id not in cache:
            cache[org_id] = list(
                MonitoringTarget.objects.filter(
                    organization_id=org_id,
                    target_type__in=("http", "https"),
                    runner_type="cloud",
                    agent_probe__isnull=True,
                )
                .order_by("-enabled", "created_at")
                .only(
                    "id",
                    "organization_id",
                    "name",
                    "endpoint",
                    "enabled",
                    "target_type",
                    "runner_type",
                    "agent_probe_id",
                )
            )
        suggestions = []
        for target in cache[org_id]:
            if str(target.pk) in linked_ids:
                continue
            if only_paused_linked and not target.enabled:
                continue
            if matches(target, "dns", instance):
                suggestions.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "endpoint": target.endpoint,
                        "enabled": bool(target.enabled),
                    }
                )
        return suggestions

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = DNSRecord
        fields = (
            "scan_availability",
            "id",
            "organization",
            "domain",
            "record_type",
            "value",
            "ttl",
            "response_time_ms",
            "last_scanned_at",
            "last_change_at",
            "last_attempt_status",
            "last_error_code",
            "last_error_message",
            "last_successful_at",
            "resolver",
            "resolver_results",
            "propagation_status",
            "expected_values",
            "reference_mode",
            "reference_updated_at",
            "matches_expected",
            "latest_change",
            "changes_last_hour",
            "linked_targets",
            "suggested_targets",
            "alert_summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "value",
            "ttl",
            "response_time_ms",
            "last_scanned_at",
            "last_change_at",
            "last_attempt_status",
            "last_error_code",
            "last_error_message",
            "last_successful_at",
            "resolver",
            "resolver_results",
            "propagation_status",
            "expected_values",
            "reference_mode",
            "reference_updated_at",
            "matches_expected",
            "latest_change",
            "changes_last_hour",
            "linked_targets",
            "suggested_targets",
            "alert_summary",
            "created_at",
            "updated_at",
        )


class DNSRecordCreateSerializer(serializers.Serializer):
    """Serializer for DNS record creation."""

    expected_values = serializers.ListField(
        child=serializers.CharField(max_length=2048), max_length=100, required=False
    )
    reference_mode = serializers.ChoiceField(
        choices=DNSRecord.ReferenceMode.choices,
        required=False,
        default=DNSRecord.ReferenceMode.EXACT,
    )
    domain = serializers.CharField(max_length=500)
    record_type = serializers.ChoiceField(choices=DNSRecord.RecordType.choices)


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
