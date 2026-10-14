"""Original audit reproductions, promoted through common.tests_audit_regressions.

Run explicitly: python manage.py test common.audit_20261012 --noinput
Asserts preserve the invariants violated by the original audited revision.
All rows live in Django's disposable test database. External sends are mocked.
"""
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditLog
from organizations.models import Organization, InvitationToken
from users.models import Team


@override_settings(REST_FRAMEWORK={
    'DEFAULT_AUTHENTICATION_CLASSES': ('accounts.authentication.SentinelJWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_THROTTLE_CLASSES': [],
}, EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PUBLIC_APP_URL='https://sentinel.example.test')
class SystemAuditProbes(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Audit A', slug='audit-local-a', plan_tier='pro')
        self.other = Organization.objects.create(name='Audit B', slug='audit-local-b')
        self.admin = User.objects.create_user('admin@audit.example.test', organization=self.org, is_staff=True)
        self.viewer = User.objects.create_user('viewer@audit.example.test', organization=self.org)
        self.foreign = User.objects.create_user('foreign@audit.example.test', organization=self.other)
        self.client = APIClient()
        self.client.force_authenticate(self.viewer)
        self.client.raise_request_exception = False

    def test_001_viewer_cannot_deactivate_admin_in_bulk(self):
        response = self.client.post('/api/v1/organizations/members/bulk-action/',
            {'action': 'deactivate', 'member_ids': [str(self.admin.pk)]}, format='json')
        self.admin.refresh_from_db()
        self.assertEqual((response.status_code, self.admin.is_active), (403, True))

    def test_002_viewer_cannot_delete_admin_in_bulk(self):
        response = self.client.post('/api/v1/organizations/members/bulk-action/',
            {'action': 'delete', 'member_ids': [str(self.admin.pk)]}, format='json')
        self.assertEqual((response.status_code, User.objects.filter(pk=self.admin.pk).exists()), (403, True))

    def test_003_viewer_cannot_create_team(self):
        response = self.client.post('/api/v1/users/teams/', {'name': 'Viewer created'}, format='json')
        self.assertEqual((response.status_code, Team.objects.filter(name='Viewer created').count()), (403, 0))

    def test_004_viewer_cannot_edit_team(self):
        team = Team.objects.create(organization=self.org, name='Original')
        response = self.client.patch(f'/api/v1/users/teams/{team.pk}/', {'name': 'Edited'}, format='json')
        team.refresh_from_db()
        self.assertEqual((response.status_code, team.name), (403, 'Original'))

    def test_005_viewer_cannot_delete_team(self):
        team = Team.objects.create(organization=self.org, name='Original')
        response = self.client.delete(f'/api/v1/users/teams/{team.pk}/')
        self.assertEqual((response.status_code, Team.objects.filter(pk=team.pk).exists()), (403, True))

    def test_006_tenant_cannot_read_unscoped_audit(self):
        marker = 'private-platform-audit-marker'
        AuditLog.objects.create(organization_id=None, action='login', module='accounts', description=marker)
        response = self.client.get('/api/v1/audit-logs/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(marker, str(response.data))

    def test_007_audit_invalid_limit_is_400_not_500(self):
        response = self.client.get('/api/v1/audit-logs/?limit=bad')
        self.assertEqual(response.status_code, 400)

    def test_008_audit_negative_limit_is_400_not_500(self):
        response = self.client.get('/api/v1/audit-logs/?limit=-1')
        self.assertEqual(response.status_code, 400)

    def test_009_direct_user_creation_respects_free_quota(self):
        self.org.plan_tier = 'free'
        self.org.save()
        self.client.force_authenticate(self.admin)
        with patch('users.services.new_challenge', create=True):
            with patch('accounts.beta.new_challenge'):
                response = self.client.post('/api/v1/users/', {
                    'email': 'new@audit.example.test', 'password': 'Audit-Strong-Password-783!'}, format='json')
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(User.objects.filter(email='new@audit.example.test').exists())

    def test_010_invitation_acceptance_respects_capacity(self):
        self.org.plan_tier = 'free'
        self.org.save()
        invite = InvitationToken.create_invitation(self.org, 'invited@audit.example.test')
        self.client.force_authenticate(None)
        with patch('accounts.beta.check_email'):
            response = self.client.post('/api/v1/organizations/invitations/accept/',
                {'token': invite.token, 'password': 'Audit-Strong-Password-783!'}, format='json')
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(User.objects.filter(email='invited@audit.example.test').exists())

    def test_011_invitation_uses_public_app_url(self):
        from notifications.models import NotificationChannel
        NotificationChannel.objects.create(organization=self.org, name='Mock email', channel_type='email', config={})
        self.client.force_authenticate(self.admin)
        with patch('notifications.services.EmailDeliveryHandler.send') as send:
            response = self.client.post('/api/v1/organizations/members/',
                {'email': 'invite@audit.example.test', 'role': 'member'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('https://sentinel.example.test/accept-invitation', send.call_args.args[1].message)

    def test_012_broker_failure_makes_health_not_ready(self):
        from config.celery import app
        with patch.object(app, 'connection_for_read', side_effect=ConnectionError('controlled broker failure')), \
                patch('common.views_health.database_ready', return_value=True), \
                patch('common.views_health.cache_ready', return_value=True), \
                patch('common.views_health.workers_ready', return_value=True):
            response = self.client.get('/api/v1/health/')
        self.assertEqual(response.status_code, 503)

    def test_013_foreign_team_detail_is_hidden(self):
        team = Team.objects.create(organization=self.other, name='Foreign')
        self.assertEqual(self.client.get(f'/api/v1/users/teams/{team.pk}/').status_code, 404)

    def test_014_expired_subscription_blocks_connection_preview(self):
        self.org.subscription_status = 'trialing'
        self.org.trial_ends_at = timezone.now() - timedelta(seconds=1)
        self.org.save()
        self.client.force_authenticate(self.admin)
        with patch('monitoring.views.TestConnectionView.perform_diagnostic') as connection:
            response = self.client.post('/api/v1/monitoring/test-connection/',
                {'endpoint': 'https://example.test', 'target_type': 'https'}, format='json')
        self.assertEqual(response.status_code, 403)
        connection.assert_not_called()

    def test_015_free_and_pro_have_contractual_minimums(self):
        self.assertEqual(self.org.get_plan_limits()['min_check_interval_seconds'], 60)
        self.assertEqual(self.other.get_plan_limits()['min_check_interval_seconds'], 300)

    def test_016_api_quota_reports_real_model_count(self):
        from api_checks.models import APICheckTarget
        from organizations.services import QuotaService
        APICheckTarget.objects.create(organization=self.org, name='Existing', url='https://example.test')
        self.assertEqual(QuotaService.get_usage_summary(self.org)['usage']['api_checks']['current'], 1)

    def test_017_status_page_quota_reports_real_model_count(self):
        from status_page.models import StatusPageConfig
        from organizations.services import QuotaService
        StatusPageConfig.objects.create(organization=self.org, company_name='Existing', slug='audit-existing')
        self.assertEqual(QuotaService.get_usage_summary(self.org)['usage']['status_pages']['current'], 1)

    def test_018_free_cannot_create_status_page_beyond_quota(self):
        from status_page.models import StatusPageConfig
        self.org.plan_tier = 'free'
        self.org.save()
        StatusPageConfig.objects.create(organization=self.org, company_name='Existing', slug='audit-existing')
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/v1/status-page/pages/',
            {'company_name': 'Second', 'slug': 'audit-second', 'is_public': False}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_019_live_sla_does_not_mark_unmeasured_target_healthy(self):
        from monitoring.models import MonitoringTarget
        from reports.services import ReportService
        MonitoringTarget.objects.create(organization=self.org, name='Unmeasured', endpoint='https://example.test')
        metrics = ReportService.get_live_sla_metrics(self.org.pk)
        self.assertIsNone(metrics['targets'][0]['uptime_percentage'])

    def test_020_agent_results_reject_nonfinite_latency(self):
        from monitoring.models import MonitoringTarget, MonitoringCheck
        from monitoring.services import AgentProbeService
        probe, token = AgentProbeService.create_probe(self.org.pk, 'Isolated audit probe')
        target = MonitoringTarget.objects.create(organization=self.org, name='Private', endpoint='10.0.0.1:80',
            target_type='tcp', runner_type='agent', agent_probe=probe, interval=60)
        AgentProbeService.process_heartbeat(probe)
        self.client.force_authenticate(None)
        response = self.client.post('/api/v1/agent-probes/submit-results/', {'results': [
            {'target_id': str(target.pk), 'status': 'up', 'response_time_ms': 'NaN'}]},
            format='json', HTTP_X_PROBE_TOKEN=token)
        self.assertEqual((response.status_code, MonitoringCheck.objects.filter(target=target).count()), (400, 0))

    def test_021_agent_results_reject_malformed_entries_without_500(self):
        from monitoring.services import AgentProbeService
        probe, token = AgentProbeService.create_probe(self.org.pk, 'Isolated audit probe')
        self.client.force_authenticate(None)
        response = self.client.post('/api/v1/agent-probes/submit-results/', {'results': ['not-an-object']},
            format='json', HTTP_X_PROBE_TOKEN=token)
        self.assertEqual(response.status_code, 400)

    def test_022_tenant_cannot_read_audit_of_another_org(self):
        marker = 'foreign-private-marker'
        AuditLog.objects.create(organization_id=self.other.pk, action='create', module='monitoring', description=marker)
        response = self.client.get('/api/v1/audit-logs/')
        self.assertNotIn(marker, str(response.data))

    def test_023_bulk_maintenance_mirrors_public_state(self):
        from maintenance.models import MaintenanceWindow
        from maintenance.services import MaintenanceWindowService
        from status_page.models import ScheduledMaintenance
        now = timezone.now()
        public = ScheduledMaintenance.objects.create(organization=self.org, title='Public', start_time=now,
            end_time=now + timedelta(hours=1), status='scheduled')
        window = MaintenanceWindow.objects.create(organization=self.org, title='Private', start_time=now,
            end_time=now + timedelta(hours=1), publish_to_status_page=True, status_page_maintenance=public)
        MaintenanceWindowService.bulk_action(self.org.pk, [window.pk], 'start', self.admin)
        public.refresh_from_db()
        self.assertEqual(public.status, 'in_progress')

    def test_024_free_cannot_create_api_beyond_quota(self):
        import socket
        from api_checks.models import APICheckTarget
        self.org.plan_tier = 'free'
        self.org.save()
        for index in range(self.org.get_plan_limits()['max_api_checks']):
            APICheckTarget.objects.create(organization=self.org, name=f'Existing {index}', url='https://example.test')
        self.client.force_authenticate(self.admin)
        addresses = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]
        with patch('socket.getaddrinfo', return_value=addresses), patch('api_checks.tasks.run_api_check.delay'):
            response = self.client.post('/api/v1/api-checks/',
                {'name': 'Over limit', 'url': 'https://example.test', 'check_interval': 300, 'enabled': False}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_025_connectivity_crud_matrix_without_outbound_tasks(self):
        import socket
        from contextlib import ExitStack
        self.client.force_authenticate(self.admin)
        specs = [
            ('monitoring', {'name': 'Audit target', 'target_type': 'tcp', 'endpoint': 'example.test:443',
                'interval': 60, 'enabled': False}, {'name': 'Renamed'}),
            ('ssl-certificates', {'domain': 'example.test'}, {'domain': 'example.test', 'port': 443}),
            ('dns-records', {'domain': 'example.test', 'record_type': 'A', 'enabled': False}, {'enabled': False}),
            ('domains', {'domain': 'example.test'}, {'domain': 'example.test'}),
            ('api-checks', {'name': 'Audit API', 'url': 'https://example.test', 'check_interval': 60, 'enabled': False}, {'name': 'Renamed'}),
            ('security-headers', {'name': 'Audit headers', 'url': 'https://example.test', 'enabled': False}, {'name': 'Renamed'}),
        ]
        tasks = ['ssl_monitor.tasks.scan_ssl_certificate.delay', 'dns_monitor.tasks.scan_dns_records.delay',
            'domain.tasks.scan_whois.delay', 'security_headers.tasks.scan_security_headers.delay',
            'api_checks.tasks.run_api_check.delay', 'monitoring.tasks.register_target_in_submonitors.delay']
        addresses = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]
        with ExitStack() as stack:
            stack.enter_context(patch('socket.getaddrinfo', return_value=addresses))
            for task in tasks:
                stack.enter_context(patch(task))
            for route, payload, update in specs:
                with self.subTest(route=route):
                    created = self.client.post(f'/api/v1/{route}/', payload, format='json')
                    self.assertEqual(created.status_code, 201, str(created.data))
                    pk = created.data['data']['id']
                    detail = f'/api/v1/{route}/{pk}/'
                    self.assertEqual(self.client.get(detail).status_code, 200)
                    self.assertEqual(self.client.patch(detail, update, format='json').status_code, 200)
                    self.client.force_authenticate(self.foreign)
                    self.assertIn(self.client.get(detail).status_code, (400, 404))
                    self.client.force_authenticate(self.viewer)
                    self.assertEqual(self.client.get(detail).status_code, 200)
                    self.assertEqual(self.client.patch(detail, update, format='json').status_code, 403)
                    self.client.force_authenticate(self.admin)
                    self.assertEqual(self.client.delete(detail).status_code, 200)
                    self.assertIn(self.client.get(detail).status_code, (400, 404))

    def test_026_enterprise_mrr_matches_plan_price(self):
        self.org.plan_tier = 'enterprise'
        self.org.save()
        self.admin.is_superuser = True
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/v1/platform-admin/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['financials']['mrr_usd'], self.org.get_plan_limits()['price_monthly_usd'])

    def test_027_alert_rule_rejects_foreign_target(self):
        from monitoring.models import MonitoringTarget
        target = MonitoringTarget.objects.create(organization=self.other, name='Foreign', endpoint='https://example.test')
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/v1/alert-rules/', {'name': 'Invalid reference', 'target_type': 'monitoring',
            'condition': 'status_down', 'target_id': str(target.pk)}, format='json')
        self.assertIn(response.status_code, (400, 404))

    def test_028_beta_free_cannot_extend_retention_beyond_plan(self):
        self.org.plan_tier = 'free'
        self.org.beta_managed = True
        self.org.metrics_retention_days = 3
        self.org.save()
        self.client.force_authenticate(self.admin)
        response = self.client.patch('/api/v1/organizations/current/',
            {'metrics_retention_days': 3650}, format='json')
        self.assertIn(response.status_code, (400, 403))

    def test_029_scope_of_platform_administration_is_enforced(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/v1/platform-admin/stats/').status_code, 403)

    def test_030_subscription_free_and_pro_summary_is_isolated(self):
        self.client.force_authenticate(self.admin)
        summary = self.client.get('/api/v1/organizations/current/subscription/')
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data['data']['limits']['min_check_interval_seconds'], 60)
        self.client.force_authenticate(self.foreign)
        summary = self.client.get('/api/v1/organizations/current/subscription/')
        self.assertEqual(summary.data['data']['limits']['min_check_interval_seconds'], 300)


@override_settings(REST_FRAMEWORK={
    'DEFAULT_AUTHENTICATION_CLASSES': ('accounts.authentication.SentinelJWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_THROTTLE_CLASSES': [],
})
class AuditQuotaConcurrency(TransactionTestCase):
    def test_031_nonbeta_concurrent_creations_cannot_exceed_quota(self):
        import socket
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import connections
        from ssl_monitor.models import SSLCertificate
        org = Organization.objects.create(name='Race fixture', slug='audit-quota-race', beta_managed=False)
        admin = User.objects.create_user('race@audit.example.test', organization=org, is_staff=True)
        limit = org.get_plan_limits()['max_ssl_certificates']
        for index in range(limit-1):
            SSLCertificate.objects.create(organization=org, domain=f'existing-{index}.example.test')
        barrier = Barrier(2)
        def create(index):
            connections.close_all()
            client = APIClient()
            client.force_authenticate(admin)
            try:
                barrier.wait(timeout=10)
                return client.post('/api/v1/ssl-certificates/', {'domain': f'new-{index}.example.test'},
                    format='json').status_code
            finally:
                connections.close_all()

        addresses = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]
        original_dns = socket.getaddrinfo
        def controlled_dns(host, *args, **kwargs):
            if str(host).endswith('.example.test'):
                return addresses
            return original_dns(host, *args, **kwargs)
        with patch('ssl_monitor.tasks.scan_ssl_certificate.delay'), patch('socket.getaddrinfo', side_effect=controlled_dns):
            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(create, (1, 2)))
        actual = SSLCertificate.objects.filter(organization=org).count()
        self.assertLessEqual(actual, limit, f'statuses={statuses}, count={actual}, limit={limit}')
        self.assertEqual(statuses.count(201), 1, f'One admitted and one limited expected; statuses={statuses}')
