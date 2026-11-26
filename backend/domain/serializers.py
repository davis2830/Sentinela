from urllib.parse import urlsplit

from django.utils import timezone
from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import DomainChangeHistory, DomainInfo


def _matches_domain_tree(host, apex):
    if not host or not apex:
        return False
    h = host.strip().lower().rstrip(".")
    a = apex.strip().lower().rstrip(".")
    return h == a or h.endswith("." + a)


class DomainChangeHistorySerializer(serializers.ModelSerializer):
    """Serializer for domain registration change history."""

    class Meta:
        model = DomainChangeHistory
        fields = (
            "id",
            "field_name",
            "old_value",
            "new_value",
            "changed_at",
        )
        read_only_fields = fields


class DomainInfoSerializer(ScanAvailabilitySerializer):
    """Serializer for DomainInfo model with dependencies, alerts, links, and change tracking."""

    effective_expiration_date = serializers.SerializerMethodField()
    effective_days_until_expiration = serializers.SerializerMethodField()
    has_unacknowledged_changes = serializers.SerializerMethodField()
    recent_changes = serializers.SerializerMethodField()
    linked_targets = serializers.SerializerMethodField()
    suggested_targets = serializers.SerializerMethodField()
    dependencies = serializers.SerializerMethodField()
    alert_summary = serializers.SerializerMethodField()

    def get_effective_expiration_date(self, instance):
        if instance.expiration_date:
            return instance.expiration_date.isoformat()
        if instance.manual_expiration_date:
            return f"{instance.manual_expiration_date.isoformat()}T00:00:00Z"
        return None

    def get_effective_days_until_expiration(self, instance):
        if instance.expiration_date:
            return (instance.expiration_date - timezone.now()).days
        if instance.manual_expiration_date:
            return (instance.manual_expiration_date - timezone.now().date()).days
        return instance.days_until_expiration

    def get_has_unacknowledged_changes(self, instance):
        if not instance.last_change_at:
            return False
        if not instance.changes_acknowledged_at:
            return True
        return instance.last_change_at > instance.changes_acknowledged_at

    def get_recent_changes(self, instance):
        cache = getattr(instance, "_prefetched_objects_cache", {})
        if "change_history" in cache:
            items = list(cache["change_history"])[:10]
        else:
            items = list(instance.change_history.all()[:10])
        return [
            {
                "id": str(c.pk),
                "field_name": c.field_name,
                "old_value": c.old_value,
                "new_value": c.new_value,
                "changed_at": c.changed_at.isoformat() if c.changed_at else None,
            }
            for c in items
        ]

    def get_linked_targets(self, instance):
        linked_cache = self.context.setdefault("_domain_linked_targets", {})
        key = str(instance.pk)
        if key in linked_cache:
            return linked_cache[key]

        prefetched = getattr(instance, "_prefetched_objects_cache", {})
        if "targetcoverage_set" in prefetched or "targetcoverage" in prefetched:
            coverages = instance.targetcoverage_set.all()
        else:
            from monitoring.models import TargetCoverage

            coverages = TargetCoverage.objects.filter(
                domain=instance,
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

    def _get_org_catalog(self, org_id):
        catalog = self.context.setdefault("_domain_org_catalog", {})
        if org_id in catalog:
            return catalog[org_id]

        from dns_monitor.models import DNSRecord
        from monitoring.models import MonitoringTarget
        from ssl_monitor.models import SSLCertificate

        targets = list(
            MonitoringTarget.objects.filter(
                organization_id=org_id,
                target_type__in=("http", "https"),
                runner_type="cloud",
                agent_probe__isnull=True,
            )
            .order_by("-enabled", "created_at")
            .only("id", "organization_id", "name", "endpoint", "enabled", "target_type", "runner_type", "agent_probe_id")
        )
        dns_domains = list(
            DNSRecord.objects.filter(organization_id=org_id).values_list("domain", flat=True)
        )
        ssl_domains = list(
            SSLCertificate.objects.filter(organization_id=org_id).values_list("domain", flat=True)
        )
        catalog[org_id] = {
            "targets": targets,
            "dns_domains": dns_domains,
            "ssl_domains": ssl_domains,
        }
        return catalog[org_id]

    def get_suggested_targets(self, instance):
        linked = self.get_linked_targets(instance)
        linked_ids = {t["id"] for t in linked}
        only_paused_linked = bool(linked) and all(not t.get("enabled", True) for t in linked)
        if linked and not only_paused_linked:
            return []

        from monitoring.coverage import matches

        org_targets = self._get_org_catalog(instance.organization_id)["targets"]
        suggestions = []
        for target in org_targets:
            if str(target.pk) in linked_ids:
                continue
            if only_paused_linked and not target.enabled:
                continue
            if matches(target, "domain", instance):
                suggestions.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "endpoint": target.endpoint,
                        "enabled": bool(target.enabled),
                    }
                )
        return suggestions

    def get_dependencies(self, instance):
        """Count targets, DNS records, and SSL certificates that depend on this domain or its subdomains."""
        org_data = self._get_org_catalog(instance.organization_id)
        apex = instance.domain

        dep_targets = []
        for target in org_data["targets"]:
            try:
                host = urlsplit(target.endpoint).hostname
            except ValueError:
                host = None
            if _matches_domain_tree(host, apex):
                dep_targets.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "enabled": bool(target.enabled),
                    }
                )

        dns_count = sum(1 for d in org_data["dns_domains"] if _matches_domain_tree(d, apex))
        ssl_count = sum(1 for d in org_data["ssl_domains"] if _matches_domain_tree(d, apex))
        return {
            "targets": dep_targets,
            "targets_count": len(dep_targets),
            "dns_count": dns_count,
            "ssl_count": ssl_count,
        }

    def get_alert_summary(self, instance):
        from alerts.models import AlertRule
        from notifications.models import NotificationChannel

        org_id = instance.organization_id
        rules_cache = self.context.setdefault("_domain_org_rules", {})
        if org_id not in rules_cache:
            rules_cache[org_id] = list(
                AlertRule.objects.filter(
                    organization_id=org_id,
                    target_type=AlertRule.TargetType.DOMAIN,
                    enabled=True,
                ).only("id", "name", "condition", "threshold", "severity", "target_id", "snoozed_until")
            )
        channels_cache = self.context.setdefault("_domain_org_channels", {})
        if org_id not in channels_cache:
            channels_cache[org_id] = list(
                NotificationChannel.objects.filter(
                    organization_id=org_id,
                    enabled=True,
                ).only("id", "name", "channel_type")
            )

        matched_rules = [
            {
                "id": str(r.pk),
                "name": r.name,
                "condition": r.condition,
                "threshold": r.threshold,
                "severity": r.severity,
                "snoozed_until": r.snoozed_until.isoformat() if r.snoozed_until else None,
            }
            for r in rules_cache[org_id]
            if r.target_id is None or str(r.target_id) == str(instance.pk)
        ]
        destinations = [
            {
                "id": str(ch.pk),
                "name": ch.name,
                "channel_type": ch.channel_type,
            }
            for ch in channels_cache[org_id]
        ]
        return {"rules": matched_rules, "destinations": destinations}

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
            "manual_expiration_date",
            "auto_renew",
            "effective_expiration_date",
            "effective_days_until_expiration",
            "last_updated",
            "status",
            "name_servers",
            "ns_health",
            "registrant_country",
            "days_until_expiration",
            "is_locked",
            "whois_server",
            "dnssec",
            "last_scanned_at",
            "error_message",
            "data_source",
            "source_url",
            "last_successful_at",
            "last_change_at",
            "changes_acknowledged_at",
            "has_unacknowledged_changes",
            "recent_changes",
            "linked_targets",
            "suggested_targets",
            "dependencies",
            "alert_summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "registrar",
            "creation_date",
            "expiration_date",
            "effective_expiration_date",
            "effective_days_until_expiration",
            "last_updated",
            "status",
            "name_servers",
            "ns_health",
            "registrant_country",
            "days_until_expiration",
            "is_locked",
            "whois_server",
            "dnssec",
            "last_scanned_at",
            "error_message",
            "data_source",
            "source_url",
            "last_successful_at",
            "last_change_at",
            "changes_acknowledged_at",
            "has_unacknowledged_changes",
            "recent_changes",
            "linked_targets",
            "suggested_targets",
            "dependencies",
            "alert_summary",
            "created_at",
            "updated_at",
        )


class DomainInfoCreateSerializer(serializers.Serializer):
    """Serializer for domain creation."""

    domain = serializers.CharField(max_length=500)
    manual_expiration_date = serializers.DateField(required=False, allow_null=True)
