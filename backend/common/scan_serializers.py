"""Read-only availability snapshots: GET must never acquire a scan reservation."""

import math
from datetime import timedelta

from django.apps import apps
from django.db.models import Prefetch, QuerySet, Window, F
from django.db.models.functions import RowNumber
from django.utils import timezone
from rest_framework import serializers

from common.authorization import effective_permissions, uses_custom_permissions
from common.models import ScanLease, ScanExecution
from common.scan_limits import interval_for
from common.subscriptions import monitoring_allowed


def resource_key(resource):
    return f"{resource.organization_id}:{resource._meta.label_lower}:{resource.pk}"


def availability(resource, user, lease=None, now=None, capabilities=None):
    now = now or timezone.now()
    can_scan = bool(user and (user.is_staff or user.is_superuser))
    if user and uses_custom_permissions(user):
        can_scan = f"{resource._meta.app_label}.scan" in (
            capabilities if capabilities is not None else effective_permissions(user)
        )
    status = "ready"
    due = None
    if not monitoring_allowed(resource.organization):
        status = "subscription_required"
    elif not user or user.organization_id != resource.organization_id or not can_scan:
        status = "read_only"
    elif not getattr(resource, "enabled", True):
        status = "disabled"
    elif getattr(resource, "runner_type", None) == "agent":
        status = "agent_managed"
    elif lease and lease.pending_until and lease.pending_until > now:
        status = "pending"
    else:
        last = getattr(resource, "last_checked_at", None) or getattr(resource, "last_scanned_at", None)
        due = last + timedelta(seconds=interval_for(resource)) if last else now
        if lease and lease.next_allowed_at:
            due = max(due, lease.next_allowed_at)
        if due > now:
            status = "cooldown"
    return {
        "status": status,
        "next_allowed_at": due.isoformat() if status == "cooldown" else None,
        "retry_after_seconds": math.ceil((due - now).total_seconds()) if status == "cooldown" else None,
    }


class AvailabilityListSerializer(serializers.ListSerializer):
    def to_representation(self, data):
        if isinstance(data, QuerySet):
            data = data.select_related("organization")
            if data.model._meta.label_lower == "monitoring.monitoringtarget":
                data = data.select_related("owner_team", "agent_probe")
                if not any(
                    getattr(lookup, "to_attr", None) == "prefetched_recent_checks"
                    for lookup in data._prefetch_related_lookups
                ):
                    checks = apps.get_model("monitoring", "MonitoringCheck").objects.order_by("-checked_at")[:20]
                    data = data.prefetch_related(
                        Prefetch("checks", queryset=checks, to_attr="prefetched_recent_checks")
                    )
        resources = list(data)
        private = [row for row in resources if getattr(row, "runner_type", None) == "agent"]
        self.context["agent_executions"] = (
            {
                row.target_id: row
                for row in apps.get_model("monitoring", "AgentExecution")
                .objects.filter(
                    target_id__in=[row.pk for row in private],
                    organization_id__in={row.organization_id for row in private},
                )
                .annotate(
                    latest=Window(
                        expression=RowNumber(), partition_by=[F("target_id")], order_by=F("created_at").desc()
                    )
                )
                .filter(latest=1)
            }
            if private
            else {}
        )
        keys = [resource_key(resource) for resource in resources]
        self.context["scan_executions"] = {
            row.resource_key: row
            for row in ScanExecution.objects.filter(resource_key__in=keys)
            .annotate(
                latest=Window(expression=RowNumber(), partition_by=[F("resource_key")], order_by=F("created_at").desc())
            )
            .filter(latest=1)
        }
        self.context["scan_leases"] = {
            lease.resource_key: lease
            for lease in ScanLease.objects.filter(
                resource_key__in=[resource_key(resource) for resource in resources],
                organization_id__in={resource.organization_id for resource in resources},
            )
        }
        self.context["scan_snapshot_at"] = timezone.now()
        return super().to_representation(resources)


class ScanAvailabilitySerializer(serializers.ModelSerializer):
    scan_availability = serializers.SerializerMethodField()

    def get_scan_availability(self, obj):
        leases = self.context.get("scan_leases")
        lease = (
            leases.get(resource_key(obj))
            if leases is not None
            else ScanLease.objects.filter(
                organization_id=obj.organization_id,
                resource_key=resource_key(obj),
            ).first()
        )
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if getattr(getattr(request, "auth", None), "scope", None) == "read":
            user = None
        if user and uses_custom_permissions(user) and "scan_capabilities" not in self.context:
            self.context["scan_capabilities"] = set(effective_permissions(user))
        result = availability(
            obj, user, lease, self.context.get("scan_snapshot_at"), self.context.get("scan_capabilities")
        )
        executions = self.context.get("scan_executions")
        execution = (
            executions.get(resource_key(obj))
            if executions is not None
            else ScanExecution.objects.filter(organization_id=obj.organization_id, resource_key=resource_key(obj))
            .order_by("-created_at")
            .first()
        )
        if execution:
            result["execution"] = {
                "id": str(execution.pk),
                "state": "expired"
                if execution.state in ("queued", "running") and execution.expires_at <= timezone.now()
                else execution.state,
                "error_code": execution.error_code,
            }
        if getattr(obj, "runner_type", None) == "agent":
            from common.executions import agent_receipt

            receipts = self.context.get("agent_executions")
            receipt = (
                receipts.get(obj.pk)
                if receipts is not None
                else (
                    apps.get_model("monitoring", "AgentExecution")
                    .objects.filter(organization_id=obj.organization_id, target_id=obj.pk)
                    .order_by("-created_at")
                    .first()
                )
            )
            if receipt:
                result["execution"] = agent_receipt(receipt)
        last = (
            obj.last_successful_at
            if hasattr(obj, "last_successful_at")
            else getattr(obj, "last_checked_at", None) or getattr(obj, "last_scanned_at", None)
        )
        cadence = max(
            interval_for(obj),
            {"ssl_monitor": 300, "dns_monitor": 300, "domain": 3600, "security_headers": 3600}.get(
                obj._meta.app_label, 0
            ),
        )
        result["measurement"] = {
            "at": last,
            "origin": "agent" if getattr(obj, "runner_type", None) == "agent" else "cloud",
            "cadence_seconds": cadence,
            "freshness": "unmeasured"
            if not last
            else "stale"
            if (timezone.now() - last).total_seconds() > cadence * 2
            else "current",
        }
        return result
