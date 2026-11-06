"""Synthetic, offline dataset. Run only in docker-compose.audit.yml via manage.py shell."""
import hashlib
import os
import re
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from organizations.models import Organization
from monitoring.models import MonitoringTarget, MonitoringCheck, AgentProbe
from api_checks.models import APICheckTarget
from ssl_monitor.models import SSLCertificate
from dns_monitor.models import DNSRecord
from domain.models import DomainInfo
from security_headers.models import SecurityHeaderTarget
from alerts.models import Alert
from incidents.models import Incident
from maintenance.models import MaintenanceWindow
from notifications.models import Notification, NotificationChannel
from reports.models import Report
from status_page.models import StatusPageConfig
from audit.models import AuditLog

suffix = os.environ.get('AUDIT_FIXTURE_SUFFIX', '')
if (not settings.DEBUG or os.environ.get('SENTINEL_E2E_FIXTURE') != '1'
        or connection.settings_dict['NAME'] != 'sentinel_audit'
        or not re.fullmatch(r'audit-perf-[a-z0-9-]{3,40}', suffix)):
    raise RuntimeError('Requires the isolated audit database, DEBUG and an explicit audit-perf fixture.')

with transaction.atomic():
    org = Organization.objects.select_for_update().get(slug=f'e2e-{suffix}', name=f'Sentinel E2E {suffix}', beta_managed=False)
    expected = {f'e2e-admin-{suffix}@example.test', f'e2e-viewer-{suffix}@example.test'}
    if set(org.users.values_list('email', flat=True)) != expected:
        raise RuntimeError('Fixture ownership mismatch; no data changed.')
    models = [MonitoringTarget, APICheckTarget, SSLCertificate, DNSRecord, DomainInfo,
              SecurityHeaderTarget, AgentProbe, Alert, Incident, MaintenanceWindow,
              Notification, NotificationChannel, Report, StatusPageConfig, AuditLog]
    if any(model.objects.filter(organization_id=org.pk).exists() for model in models):
        raise RuntimeError('Use a fresh empty fixture; never overwrite resources.')
    org.plan_tier = 'pro'
    org.subscription_status = 'active'
    org.save(update_fields=['plan_tier', 'subscription_status'])
    now = timezone.now()
    targets = MonitoringTarget.objects.bulk_create([
        MonitoringTarget(organization=org, name=f'Synthetic {i}', endpoint=f'https://resource-{i}.example.test',
                         target_type='https', interval=60, enabled=False) for i in range(25)])
    MonitoringCheck.objects.bulk_create([
        MonitoringCheck(target=target, status='down' if i % 20 == 0 else 'up',
                        latency=100 + i % 300, checked_at=now - timedelta(minutes=i))
        for target in targets for i in range(100)])
    specs = [
        (APICheckTarget, lambda i: {'name': f'API {i}', 'url': f'https://api-{i}.example.test', 'enabled': False}),
        (SSLCertificate, lambda i: {'domain': f'ssl-{i}.example.test'}),
        (DNSRecord, lambda i: {'domain': f'dns-{i}.example.test', 'record_type': 'A'}),
        (DomainInfo, lambda i: {'domain': f'domain-{i}.example.test'}),
        (SecurityHeaderTarget, lambda i: {'name': f'Headers {i}', 'url': f'https://headers-{i}.example.test', 'enabled': False}),
        (Alert, lambda i: {'title': f'Synthetic alert {i}', 'target_type': 'monitoring', 'target_id': targets[i].id}),
        (Notification, lambda i: {'title': f'Synthetic delivery {i}', 'message': 'Offline fixture only', 'status': 'failed'}),
        (AuditLog, lambda i: {'action': 'read', 'module': 'audit_fixture', 'description': f'Synthetic event {i}'}),
    ]
    for model, fields in specs:
        model.objects.bulk_create([model(organization_id=org.pk, **fields(i)) for i in range(25)])
    AgentProbe.objects.bulk_create([AgentProbe(organization=org, name=f'Offline agent {i}',
        token_hash=hashlib.sha256(f'non-operational-audit-{i}'.encode()).hexdigest()) for i in range(3)])
    Incident.objects.bulk_create([Incident(organization=org, title=f'Synthetic incident {i}') for i in range(5)])
    Report.objects.bulk_create([Report(organization=org, title=f'Synthetic report {i}', report_type='summary', status='failed') for i in range(5)])
    MaintenanceWindow.objects.bulk_create([MaintenanceWindow(organization=org, title=f'Synthetic maintenance {i}',
        start_time=now + timedelta(days=i), end_time=now + timedelta(days=i, hours=1)) for i in range(5)])
    StatusPageConfig.objects.bulk_create([StatusPageConfig(organization=org, company_name='Synthetic private page',
        slug=f'{suffix}-{i}', is_public=False) for i in range(2)])
    NotificationChannel.objects.create(organization=org, name='Disabled synthetic channel', channel_type='email', enabled=False)
print('Synthetic dataset created: 25 resources per connectivity module; 2500 monitoring checks; no tasks or deliveries.')
