"""Cross-module beta gates. All data lives in Django's disposable test database."""
from datetime import timedelta
from unittest.mock import patch
from importlib import import_module
from uuid import uuid4

from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.urls import URLPattern, URLResolver
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from incidents.models import Incident, IncidentAlert
from incidents.services import IncidentService
from monitoring.models import MonitoringTarget
from notifications.models import Notification, NotificationChannel
from notifications.services import NotificationService
from organizations.models import Organization
from reports.models import Report
from reports.services import ReportService, ReportExporter
from status_page.models import ScheduledMaintenance, StatusPageConfig
from status_page.services import StatusPageService


@override_settings(REST_FRAMEWORK={
    'DEFAULT_AUTHENTICATION_CLASSES': ('accounts.authentication.SentinelJWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_THROTTLE_CLASSES': [],
})
class ModuleAuditTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Audit A', slug='module-audit-a')
        self.other = Organization.objects.create(name='Audit B', slug='module-audit-b')
        self.admin = User.objects.create_user('audit-admin@example.test', organization=self.org, is_staff=True)
        self.viewer = User.objects.create_user('audit-viewer@example.test', organization=self.org)
        self.foreign_user = User.objects.create_user('foreign@example.test', organization=self.other)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def management_routes(self):
        def walk(patterns, prefix):
            for entry in patterns:
                route = str(entry.pattern)
                for name, converter in getattr(entry.pattern, 'converters', {}).items():
                    route = route.replace(f'<uuid:{name}>', str(uuid4()))
                    route = route.replace(f'<str:{name}>', 'audit-slug')
                if isinstance(entry, URLResolver):
                    yield from walk(entry.url_patterns, prefix + route)
                elif isinstance(entry, URLPattern) and '/public/' not in prefix + route:
                    yield prefix + route, entry.callback.cls
        for module in ('alerts', 'incidents', 'maintenance', 'notifications', 'reports', 'status_page'):
            prefix = 'alert-rules' if module == 'alerts' else module.replace('_', '-')
            yield from walk(import_module(f'{module}.urls').urlpatterns, f'/api/v1/{prefix}/')
        yield from walk(import_module('alerts.urls_alerts').urlpatterns, '/api/v1/alerts/')

    def test_every_management_mutation_rejects_viewer_before_validation(self):
        self.client.force_authenticate(self.viewer)
        for url, view in self.management_routes():
            for method in ('post', 'patch', 'put', 'delete'):
                if hasattr(view, method):
                    with self.subTest(url=url, method=method):
                        response = getattr(self.client, method)(url, {}, format='json')
                        self.assertEqual(response.status_code, 403)

    def test_unaffiliated_accounts_cannot_access_tenant_modules(self):
        unaffiliated = User.objects.create_user('no-org@example.test', is_staff=True)
        self.client.force_authenticate(unaffiliated)
        for module in ('alerts', 'incidents', 'maintenance', 'notifications/channels', 'reports', 'status-page/pages'):
            with self.subTest(module=module):
                self.assertEqual(self.client.get(f'/api/v1/{module}/').status_code, 403)

    def test_status_get_never_creates_or_publishes_a_page(self):
        for path in ('pages/', 'config/', 'stats/'):
            response = self.client.get('/api/v1/status-page/' + path)
            self.assertIn(response.status_code, (200, 404))
            self.assertFalse(StatusPageConfig.objects.exists())

    def test_incident_rejects_foreign_assignee_on_create_and_assign(self):
        with self.assertRaises(ValueError):
            IncidentService.create_incident(self.org.pk, 'Rejected', assigned_to_id=self.foreign_user.pk)
        self.assertFalse(Incident.objects.exists())
        incident = IncidentService.create_incident(self.org.pk, 'Own incident')
        with self.assertRaises(ValueError):
            IncidentService.assign_incident(incident.pk, self.org.pk, user_id=self.foreign_user.pk)
        incident.refresh_from_db()
        self.assertIsNone(incident.assigned_to_id)

    def test_notification_rejects_foreign_channel(self):
        channel = NotificationChannel.objects.create(organization=self.other, name='Foreign', channel_type='email')
        with self.assertRaises(ValueError):
            NotificationService.create_notification(self.org.pk, channel.pk, 'Rejected', 'Must not deliver')
        self.assertFalse(Notification.objects.exists())

    def test_empty_public_page_does_not_publish_unselected_resources_or_incidents(self):
        page = StatusPageConfig.objects.create(organization=self.org, company_name='Public', slug='audit-public')
        MonitoringTarget.objects.create(organization=self.org, name='Internal name', endpoint='https://example.com')
        IncidentService.create_incident(self.org.pk, 'Private incident', description='Private operational details')
        data = StatusPageService.get_public_status_data(page.slug)
        self.assertEqual(data['services'], [])
        self.assertEqual(data['active_incidents'], [])
        self.assertEqual(data['system_status'], 'unknown')
        self.assertIsNone(data['global_uptime_pct'])

    def test_unmeasured_published_service_has_unknown_not_healthy_history(self):
        target = MonitoringTarget.objects.create(organization=self.org, name='New', endpoint='https://example.com')
        page = StatusPageConfig.objects.create(organization=self.org, company_name='Public', slug='audit-new',
            component_settings=[{'id': str(target.pk), 'is_visible': True}])
        data = StatusPageService.get_public_status_data(page.slug)
        service = data['services'][0]
        self.assertEqual(service['current_status'], 'unknown')
        self.assertIsNone(service['uptime_90_days_pct'])
        self.assertTrue(all(day['status'] == 'unknown' and day['uptime_pct'] is None for day in service['history_90_days']))

    def test_status_maintenance_rejects_foreign_page_and_invalid_time_range(self):
        foreign = StatusPageConfig.objects.create(organization=self.other, company_name='Foreign', slug='audit-foreign')
        now = timezone.now()
        for page_id, end in ((foreign.pk, now + timedelta(hours=1)), (None, now - timedelta(hours=1))):
            with self.subTest(page_id=page_id), self.assertRaises(ValueError):
                StatusPageService.create_maintenance(self.org.pk, {
                    'title': 'Rejected', 'status_page_id': page_id, 'start_time': now, 'end_time': end})
        self.assertFalse(ScheduledMaintenance.objects.exists())

    def test_report_exports_reject_tokens_in_urls(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        report = Report.objects.create(organization=self.org, title='Private', report_type='summary')
        token = str(RefreshToken.for_user(self.admin).access_token)
        self.client.force_authenticate(None)
        for extension in ('csv', 'pdf'):
            with self.subTest(extension=extension):
                response = self.client.get(f'/api/v1/reports/{report.pk}/export/{extension}/', {'token': token})
                self.assertEqual(response.status_code, 401)

    def test_all_resource_lists_and_details_exclude_foreign_organization(self):
        from api_checks.models import APICheckTarget
        from ssl_monitor.models import SSLCertificate
        from dns_monitor.models import DNSRecord
        from domain.models import DomainInfo
        from security_headers.models import SecurityHeaderTarget
        from monitoring.models import AgentProbe
        from alerts.models import Alert, AlertRule
        from maintenance.models import MaintenanceWindow
        from audit.models import AuditLog
        now = timezone.now()
        specs = [
            ('monitoring', MonitoringTarget, {'name': 'Foreign', 'endpoint': 'https://example.com'}),
            ('api-checks', APICheckTarget, {'name': 'Foreign', 'url': 'https://example.com'}),
            ('ssl-certificates', SSLCertificate, {'domain': 'example.com'}),
            ('dns-records', DNSRecord, {'domain': 'example.com', 'record_type': 'A'}),
            ('domains', DomainInfo, {'domain': 'example.com'}),
            ('security-headers', SecurityHeaderTarget, {'name': 'Foreign', 'url': 'https://example.com'}),
            ('agent-probes', AgentProbe, {'name': 'Foreign', 'token_hash': 'test-hash'}),
            ('alert-rules', AlertRule, {'name': 'Foreign', 'target_type': 'monitoring', 'condition': 'down'}),
            ('alerts', Alert, {'title': 'Foreign', 'target_type': 'monitoring'}),
            ('incidents', Incident, {'title': 'Foreign'}),
            ('notifications/channels', NotificationChannel, {'name': 'Foreign', 'channel_type': 'email'}),
            ('notifications', Notification, {'title': 'Foreign', 'message': 'Private'}),
            ('reports', Report, {'title': 'Foreign', 'report_type': 'summary'}),
            ('maintenance', MaintenanceWindow, {'title': 'Foreign', 'start_time': now, 'end_time': now + timedelta(hours=1)}),
            ('status-page/pages', StatusPageConfig, {'company_name': 'Foreign', 'slug': 'foreign-only'}),
            ('audit-logs', AuditLog, {'action': 'create', 'module': 'test', 'description': 'Private'}),
        ]
        for route, model, fields in specs:
            item = model.objects.create(organization_id=self.other.pk, **fields)
            with self.subTest(route=route):
                listed = self.client.get(f'/api/v1/{route}/')
                self.assertEqual(listed.status_code, 200)
                self.assertNotIn(str(item.pk), str(listed.data))
                detail = self.client.get(f'/api/v1/{route}/{item.pk}/')
                self.assertIn(detail.status_code, (400, 404, 405))
                self.assertNotIn(str(item.pk), str(getattr(detail, 'data', detail.content)))

    def test_incident_alert_link_requires_both_resources_in_same_tenant(self):
        from alerts.models import Alert
        own = IncidentService.create_incident(self.org.pk, 'Own')
        foreign = IncidentService.create_incident(self.other.pk, 'Foreign')
        alert = Alert.objects.create(organization=self.other, title='Foreign')
        for incident, alert_id in ((own, alert.pk), (foreign, alert.pk)):
            response = self.client.post(f'/api/v1/incidents/{incident.pk}/alerts/', {'alert_id': str(alert_id)}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertFalse(IncidentAlert.objects.exists())

    def test_operational_maintenance_rejects_foreign_relations_and_targets(self):
        from maintenance.services import MaintenanceWindowService
        from maintenance.models import MaintenanceWindow
        target = MonitoringTarget.objects.create(organization=self.other, name='Foreign', endpoint='https://example.com')
        now = timezone.now()
        for extra in ({'responsible_user': self.foreign_user},
                      {'targets': [{'target_type': 'monitoring', 'target_id': target.pk}]}):
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                MaintenanceWindowService.create_window(self.org.pk, {
                    'title': 'Rejected', 'start_time': now, 'end_time': now + timedelta(hours=1), **extra})
        self.assertFalse(MaintenanceWindow.objects.exists())

    def test_status_page_directory_queries_are_constant(self):
        def count():
            with CaptureQueriesContext(connection) as queries:
                StatusPageService.list_status_pages(self.org.pk)
            return len(queries)
        StatusPageConfig.objects.create(organization=self.org, company_name='First', slug='query-first')
        initial = count()
        for index in range(5):
            StatusPageConfig.objects.create(organization=self.org, company_name='More', slug=f'query-{index}')
        self.assertEqual(count(), initial)

    def test_notification_delivery_is_real_locmem_and_repeat_is_idempotent(self):
        from django.core import mail
        channel = NotificationChannel.objects.create(organization=self.org, name='Audit mail', channel_type='email',
            config={'recipients': ['recipient@example.test']})
        note = NotificationService.create_notification(self.org.pk, channel.pk, 'Audit', 'Local test only')
        with self.settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            self.assertTrue(NotificationService.send_notification(note.pk))
            self.assertTrue(NotificationService.send_notification(note.pk))
            self.assertEqual(len(mail.outbox), 1)
        note.refresh_from_db()
        self.assertEqual(note.status, 'sent')

    def test_failed_notification_does_not_claim_delivery(self):
        channel = NotificationChannel.objects.create(organization=self.org, name='Audit', channel_type='email')
        note = NotificationService.create_notification(self.org.pk, channel.pk, 'Audit', 'Fail safely')
        with patch('notifications.services.EmailDeliveryHandler.send', side_effect=RuntimeError('Simulated failure')):
            self.assertFalse(NotificationService.send_notification(note.pk))
        note.refresh_from_db()
        self.assertEqual(note.status, 'failed')
        self.assertIsNone(note.sent_at)

    def test_private_status_page_cannot_accept_public_subscription(self):
        page = StatusPageConfig.objects.create(organization=self.org, company_name='Private', slug='private-audit', is_public=False)
        with self.assertRaises(ValueError):
            StatusPageService.subscribe_email(page.slug, 'recipient@example.test')

    def test_report_html_escapes_user_content(self):
        report = Report.objects.create(organization=self.org, title='<script>alert(1)</script>', report_type='sla',
            data={'targets': [{'target_name': '<img src=x onerror=alert(1)>', 'endpoint': '<script>bad()</script>'}]})
        html, _ = ReportExporter.export_html_pdf(report)
        self.assertNotIn('<script>', html)
        self.assertNotIn('<img src=x', html)
        self.assertIn('&lt;script&gt;', html)

    def test_all_six_report_generators_complete_without_foreign_data(self):
        MonitoringTarget.objects.create(organization=self.other, name='Foreign report sentinel', endpoint='https://example.com')
        for kind in Report.ReportType.values:
            with self.subTest(kind=kind):
                report = ReportService.create_report(self.org.pk, kind, 'Audit ' + kind)
                self.assertEqual(report.status, 'completed', report.error_message)
                self.assertNotIn('Foreign report sentinel', str(report.data))

    def test_incident_full_lifecycle_and_link_deduplication(self):
        from alerts.models import Alert
        incident = IncidentService.create_incident(self.org.pk, 'Lifecycle')
        alert = Alert.objects.create(organization=self.org, title='Own alert')
        IncidentService.add_alert(incident.pk, alert.pk, organization_id=self.org.pk)
        IncidentService.add_alert(incident.pk, alert.pk, organization_id=self.org.pk)
        self.assertEqual(incident.incident_alerts.count(), 1)
        for state in ('investigating', 'identified', 'mitigated', 'resolved', 'closed'):
            IncidentService.update_status(incident.pk, self.org.pk, state)
        incident.refresh_from_db()
        self.assertEqual(incident.status, 'closed')
        self.assertIsNotNone(incident.acknowledged_at)
        self.assertIsNotNone(incident.resolved_at)

    def test_read_only_api_token_cannot_mutate_management(self):
        from accounts.models import APIToken
        raw = 'snt_audit_read_only_secret'
        import hashlib
        APIToken.objects.create(user=self.admin, name='Audit', token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            token_prefix='snt_audit', scope='read')
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + raw)
        response = self.client.post('/api/v1/incidents/', {'title': 'Rejected'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_missing_status_page_id_does_not_fall_back_to_another_page(self):
        StatusPageConfig.objects.create(organization=self.org, company_name='Own', slug='own-fallback', is_default=True)
        for route in ('config/', 'stats/'):
            self.assertEqual(self.client.get('/api/v1/status-page/' + route, {'page_id': str(uuid4())}).status_code, 404)

    def test_viewer_cannot_read_channel_credentials_or_api_request_payloads(self):
        from api_checks.models import APICheckTarget
        channel = NotificationChannel.objects.create(organization=self.org, name='Private config', channel_type='webhook',
            config={'webhook_url': 'https://example.com/secret', 'smtp_password': 'audit-secret'})
        target = APICheckTarget.objects.create(organization=self.org, name='Private API', url='https://example.com',
            request_headers={'Authorization': 'Bearer audit-secret'}, request_body={'password': 'audit-secret'})
        self.client.force_authenticate(self.viewer)
        for path in (f'notifications/channels/{channel.pk}/', f'api-checks/{target.pk}/'):
            response = self.client.get('/api/v1/' + path)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('audit-secret', str(response.data))

    def test_unsaved_channel_diagnostic_respects_expired_subscription(self):
        self.org.subscription_status = 'past_due'
        self.org.save(update_fields=['subscription_status'])
        with patch('notifications.services.NotificationService.test_channel_config') as send:
            response = self.client.post('/api/v1/notifications/test-connection/', {
                'channel_type': 'email', 'config': {'recipients': ['recipient@example.test']}}, format='json')
        self.assertEqual(response.status_code, 403)
        send.assert_not_called()

    def test_reports_and_live_metrics_do_not_fabricate_uptime_without_checks(self):
        MonitoringTarget.objects.create(organization=self.org, name='Unmeasured', endpoint='https://example.com')
        live = ReportService.get_live_sla_metrics(self.org.pk)
        self.assertIsNone(live['current_sla'])
        self.assertIsNone(live['targets'][0]['meets_sla'])
        self.assertEqual(live['failing_sla'], 0)
        self.assertIsNone(live['mttd_minutes'])
        for kind in ('sla', 'availability', 'summary'):
            report = ReportService.create_report(self.org.pk, kind, 'No measurements')
            self.assertEqual(report.status, 'completed', report.error_message)
            if kind == 'sla':
                self.assertIsNone(report.data['overall_sla'])
            elif kind == 'summary':
                self.assertIsNone(report.data['summary']['overall_sla_percentage'])
            else:
                self.assertIsNone(report.data['targets'][0]['availability_percentage'])

    def test_live_reports_reject_invalid_or_unbounded_ranges(self):
        for days, sla in ((0, 99.9), (367, 99.9), (1, 101), (1, float('nan'))):
            with self.subTest(days=days, sla=sla), self.assertRaises(ValueError):
                ReportService.get_live_sla_metrics(self.org.pk, sla, days)

    def test_dns_reordering_does_not_create_a_false_change(self):
        from dns_monitor.models import DNSRecord, DNSChangeHistory
        from dns_monitor.services import DNSMonitorService
        record = DNSRecord.objects.create(organization=self.org, domain='example.com', record_type='A', value='1.1.1.1\n8.8.8.8')
        DNSMonitorService.update_record_scan(record.pk, '8.8.8.8\n1.1.1.1', 60)
        self.assertFalse(DNSChangeHistory.objects.exists())

    def test_sla_excludes_only_matching_maintenance_and_accepts_slow(self):
        from monitoring.models import MonitoringCheck
        from maintenance.models import MaintenanceWindow, MaintenanceWindowTarget
        now = timezone.now()
        target = MonitoringTarget.objects.create(organization=self.org, name='SLA', endpoint='https://example.com')
        for minutes, status in ((20, 'slow'), (10, 'down'), (1, 'up')):
            MonitoringCheck.objects.create(target=target, status=status, checked_at=now - timedelta(minutes=minutes))
        window = MaintenanceWindow.objects.create(organization=self.org, title='Planned', status='completed',
            start_time=now - timedelta(minutes=15), end_time=now - timedelta(minutes=5))
        MaintenanceWindowTarget.objects.create(maintenance_window=window, target_type='monitoring', target_id=target.pk)
        live = ReportService.get_live_sla_metrics(self.org.pk)
        self.assertEqual(live['current_sla'], 100)
        self.assertEqual(live['targets'][0]['total_checks'], 2)
        for kind in ('sla', 'availability', 'summary'):
            report = ReportService.create_report(self.org.pk, kind, 'Excluded')
            self.assertEqual(report.status, 'completed', report.error_message)
            value = (report.data['overall_sla'] if kind == 'sla' else
                     report.data['targets'][0]['availability_percentage'] if kind == 'availability' else
                     report.data['summary']['overall_sla_percentage'])
            self.assertEqual(value, 100)
        window.exclude_from_sla = False
        window.save()
        self.assertAlmostEqual(ReportService.get_live_sla_metrics(self.org.pk)['current_sla'], 66.67)

    def test_zero_email_delivery_is_failed_not_sent(self):
        channel = NotificationChannel.objects.create(organization=self.org, name='Email', channel_type='email',
            config={'recipients': ['isolated@example.test']})
        notification = Notification.objects.create(organization=self.org, channel=channel, title='Zero', message='Zero')
        with patch('notifications.services.send_mail', return_value=0):
            self.assertFalse(NotificationService.send_notification(notification.pk))
        notification.refresh_from_db()
        self.assertEqual(notification.status, 'failed')
        self.assertIsNone(notification.sent_at)

    def test_monitoring_slow_is_available_but_not_healthy(self):
        from monitoring.models import MonitoringCheck
        from monitoring.services import MonitoringService
        now = timezone.now()
        target = MonitoringTarget.objects.create(organization=self.org, name='Slow', endpoint='https://example.com',
            last_status='slow', last_checked_at=now)
        MonitoringCheck.objects.create(target=target, status='slow', checked_at=now, latency=600)
        stats = MonitoringService.get_uptime_stats(target.pk, self.org.pk)
        self.assertEqual(stats['uptime_percentage'], 100)
        series = MonitoringService.get_timeseries_metrics(target.pk, self.org.pk)
        self.assertEqual(series['summary']['uptime_percentage'], 100)
        target.refresh_from_db()
        self.assertEqual(target.last_status, 'slow')

    def test_maintenance_scope_boundaries_and_recurrence(self):
        from monitoring.models import MonitoringCheck
        from maintenance.models import MaintenanceWindow, MaintenanceWindowTarget
        from maintenance.sla import eligible_checks
        now = timezone.now()
        target = MonitoringTarget.objects.create(organization=self.org, name='Boundaries', endpoint='https://example.com')
        for at in (now - timedelta(hours=1), now, now + timedelta(hours=1)):
            MonitoringCheck.objects.create(target=target, status='down', checked_at=at)
        window = MaintenanceWindow.objects.create(organization=self.other, title='Foreign',
            start_time=now - timedelta(hours=1), end_time=now)
        MaintenanceWindowTarget.objects.create(maintenance_window=window, target_type='all')
        qs = target.checks.all()
        start, end = now - timedelta(days=8), now + timedelta(days=1)
        self.assertEqual(eligible_checks(qs, self.org.pk, target.pk, start, end).count(), 3)
        window.organization = self.org
        window.save()
        self.assertEqual(eligible_checks(qs, self.org.pk, target.pk, start, end).count(), 2)
        window.status = 'cancelled'
        window.save()
        self.assertEqual(eligible_checks(qs, self.org.pk, target.pk, start, end).count(), 3)
        window.status = 'scheduled'
        window.recurrence = 'weekly'
        window.start_time -= timedelta(days=7)
        window.end_time -= timedelta(days=7)
        window.save()
        self.assertEqual(eligible_checks(qs, self.org.pk, target.pk, start, end).count(), 2)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_outage_recovery_notifies_and_does_not_group_unrelated_targets(self):
        from alerts.models import AlertRule, Alert
        from alerts.services import AlertEvaluatorService
        from django.core import mail
        NotificationChannel.objects.create(organization=self.org, name='Lifecycle', channel_type='email',
            config={'recipients': ['isolated@example.test']}, subscribed_events=['alert_triggered', 'alert_resolved'])
        targets = [MonitoringTarget.objects.create(organization=self.org, name=f'Service {i}',
            endpoint='https://example.com', last_status='down') for i in range(2)]
        rules = [AlertRule.objects.create(organization=self.org, name=f'Down {i}', target_type='monitoring',
            target_id=t.pk, condition='status_down', severity='critical') for i, t in enumerate(targets)]
        for rule in rules:
            self.assertTrue(AlertEvaluatorService._check_status_down(rule))
        self.assertEqual(Incident.objects.filter(organization=self.org).count(), 2)
        self.assertEqual(len(mail.outbox), 2)
        self.assertTrue(AlertEvaluatorService._check_status_down(rules[0]))
        self.assertEqual(len(mail.outbox), 2)
        targets[0].last_status = 'up'
        targets[0].save()
        self.assertFalse(AlertEvaluatorService._check_status_down(rules[0]))
        self.assertEqual(Alert.objects.get(rule=rules[0]).status, 'resolved')
        self.assertEqual(Alert.objects.get(rule=rules[1]).status, 'active')
        self.assertEqual(len(mail.outbox), 3)
        # Recovery does not automatically close an incident; that remains an operator decision.
        self.assertEqual(Incident.objects.filter(organization=self.org, status='open').count(), 2)

    @override_settings(TIME_ZONE='America/Guatemala')
    def test_public_history_queries_are_constant_and_slow_is_degraded(self):
        from monitoring.models import MonitoringCheck
        now = timezone.now()
        page = StatusPageConfig.objects.create(organization=self.org, company_name='Audit', slug='batch-public', is_public=True)
        def add_target(index):
            target = MonitoringTarget.objects.create(organization=self.org, name=f'Batch {index}',
                endpoint='https://example.com', last_status='slow', last_checked_at=now)
            MonitoringCheck.objects.create(target=target, status='slow', latency=600, checked_at=now)
            return str(target.pk)
        page.monitored_targets = [add_target(0)]
        page.save()
        with CaptureQueriesContext(connection) as one:
            result = StatusPageService.get_public_status_data('batch-public')
        self.assertEqual(result['system_status'], 'degraded')
        self.assertEqual(result['services'][0]['uptime_90_days_pct'], 100)
        self.assertEqual(result['services'][0]['history_90_days'][-1]['date'], timezone.localdate(now).isoformat())
        self.assertEqual(result['services'][0]['history_90_days'][-1]['total_checks'], 1)
        page.monitored_targets += [add_target(i) for i in range(1, 5)]
        page.save()
        with CaptureQueriesContext(connection) as many:
            StatusPageService.get_public_status_data('batch-public')
        self.assertEqual(len(one), len(many))

    def test_report_csv_neutralizes_formulas_without_changing_numeric_values(self):
        import csv
        import io
        from reports.services import SafeCSVWriter
        output = io.StringIO()
        SafeCSVWriter(output).writerow(['=1+1', ' \t@SUM(A1)', '+cmd', '-cmd', -5, 'ordinary'])
        self.assertEqual(next(csv.reader(io.StringIO(output.getvalue()))),
                         ["'=1+1", "' \t@SUM(A1)", "'+cmd", "'-cmd", '-5', 'ordinary'])

    def test_custom_smtp_rejects_private_destinations_and_pins_public_connection(self):
        from common.safe_smtp import PublicSMTP
        from rest_framework.exceptions import ValidationError
        smtp = PublicSMTP()
        with patch('common.safe_smtp.socket.create_connection') as connect:
            with self.assertRaises(ValidationError):
                smtp._get_socket('127.0.0.1', 587, 10)
            connect.assert_not_called()
            with patch('common.safe_smtp.resolve_safe_target_endpoint', return_value=(
                'http://mail.example.com:587', 'mail.example.com', 587, ('93.184.216.34',))):
                smtp._get_socket('mail.example.com', 587, 10)
            self.assertEqual(connect.call_args.args[0], ('93.184.216.34', 587))


class NotificationConcurrencyAuditTests(TransactionTestCase):
    def test_two_database_connections_deliver_only_once(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier, Lock
        from django.db import close_old_connections, connections
        import time
        org = Organization.objects.create(name='Concurrent audit', slug='concurrent-audit')
        channel = NotificationChannel.objects.create(organization=org, name='Email', channel_type='email',
            config={'recipients': ['isolated@example.test']})
        notification = Notification.objects.create(organization=org, channel=channel, title='Concurrent', message='Isolated')
        barrier, lock, deliveries = Barrier(2), Lock(), []
        def send(*args):
            with lock:
                deliveries.append(1)
            time.sleep(0.15)
            return ('Isolated delivery', 250, 1)
        def worker():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                return NotificationService.send_notification(notification.pk)
            finally:
                connections.close_all()
        with patch('notifications.services.EmailDeliveryHandler.send', side_effect=send):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(worker) for _ in range(2)]
                self.assertTrue(all(future.result(timeout=10) for future in futures))
        self.assertEqual(len(deliveries), 1)
        notification.refresh_from_db()
        self.assertEqual(notification.status, 'sent')
