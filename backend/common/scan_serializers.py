"""Read-only availability snapshots: GET must never acquire a scan reservation."""
import math
from datetime import timedelta

from django.apps import apps
from django.db.models import Prefetch, QuerySet
from django.utils import timezone
from rest_framework import serializers

from common.models import ScanLease
from common.scan_limits import interval_for
from common.subscriptions import monitoring_allowed


def resource_key(resource):
    return f'{resource.organization_id}:{resource._meta.label_lower}:{resource.pk}'


def availability(resource, user, lease=None, now=None):
    now = now or timezone.now()
    status = 'ready'
    due = None
    if not monitoring_allowed(resource.organization):
        status = 'subscription_required'
    elif not user or user.organization_id != resource.organization_id or not (user.is_staff or user.is_superuser):
        status = 'read_only'
    elif not getattr(resource, 'enabled', True):
        status = 'disabled'
    elif getattr(resource, 'runner_type', None) == 'agent':
        status = 'agent_managed'
    elif lease and lease.pending_until and lease.pending_until > now:
        status = 'pending'
    else:
        last = getattr(resource, 'last_checked_at', None) or getattr(resource, 'last_scanned_at', None)
        due = last + timedelta(seconds=interval_for(resource)) if last else now
        if lease and lease.next_allowed_at:
            due = max(due, lease.next_allowed_at)
        if due > now:
            status = 'cooldown'
    return {
        'status': status,
        'next_allowed_at': due.isoformat() if status == 'cooldown' else None,
        'retry_after_seconds': math.ceil((due - now).total_seconds()) if status == 'cooldown' else None,
    }


class AvailabilityListSerializer(serializers.ListSerializer):
    def to_representation(self, data):
        if isinstance(data, QuerySet):
            data = data.select_related('organization')
            if data.model._meta.label_lower == 'monitoring.monitoringtarget':
                data = data.select_related('owner_team', 'agent_probe')
                if not any(getattr(lookup, 'to_attr', None) == 'prefetched_recent_checks' for lookup in data._prefetch_related_lookups):
                    checks = apps.get_model('monitoring', 'MonitoringCheck').objects.order_by('-checked_at')[:20]
                    data = data.prefetch_related(Prefetch('checks', queryset=checks, to_attr='prefetched_recent_checks'))
        resources = list(data)
        self.context['scan_leases'] = {lease.resource_key: lease for lease in ScanLease.objects.filter(
            resource_key__in=[resource_key(resource) for resource in resources],
            organization_id__in={resource.organization_id for resource in resources},
        )}
        self.context['scan_snapshot_at'] = timezone.now()
        return super().to_representation(resources)


class ScanAvailabilitySerializer(serializers.ModelSerializer):
    scan_availability = serializers.SerializerMethodField()

    def get_scan_availability(self, obj):
        leases = self.context.get('scan_leases')
        lease = leases.get(resource_key(obj)) if leases is not None else ScanLease.objects.filter(
            organization_id=obj.organization_id, resource_key=resource_key(obj),
        ).first()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if getattr(getattr(request, 'auth', None), 'scope', None) == 'read':
            user = None
        return availability(obj, user, lease, self.context.get('scan_snapshot_at'))
