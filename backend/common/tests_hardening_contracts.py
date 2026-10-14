"""Alternative-path regressions; disposable data and controlled dependencies only."""
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User
from organizations.models import Organization, InvitationToken
from organizations.services import QuotaService, QuotaExceededException
from common.membership import check_member_capacity, LastAdminRequired
from common.retention_policy import retention_policy
from users.services import UserService


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
                   PUBLIC_APP_URL='https://sentinel.example.test',
                   ENFORCE_LEGACY_EMAIL_VERIFICATION=False)
class HardeningContracts(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Contracts', slug='contracts', plan_tier='pro')
        self.admin = User.objects.create_user('admin@contracts.example.test', organization=self.org,
                                             is_staff=True, email_verified_at=timezone.now())
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_last_admin_cannot_be_deactivated_or_demoted(self):
        for fields in ({'is_active': False}, {'role': 'viewer'}):
            with self.subTest(fields=fields), self.assertRaises(LastAdminRequired):
                UserService.update_user(self.admin.pk, self.org.pk, **fields)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active and self.admin.is_staff)

    def test_last_admin_rejection_is_400_not_500(self):
        response = self.client.patch(f'/api/v1/users/{self.admin.pk}/', {'role': 'viewer'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['errors']['code'], 'LAST_ADMIN_REQUIRED')

    def test_unverified_replacement_is_not_effective_admin(self):
        User.objects.create_user('pending@contracts.example.test', organization=self.org,
                                 is_staff=True, verification_required=True)
        with self.assertRaises(LastAdminRequired):
            UserService.delete_user(self.admin.pk, self.org.pk)

    def test_verified_replacement_allows_removal(self):
        User.objects.create_user('replacement@contracts.example.test', organization=self.org,
                                 is_staff=True, email_verified_at=timezone.now())
        UserService.update_user(self.admin.pk, self.org.pk, role='viewer')
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.is_staff)

    def test_inactive_accounts_and_pending_invites_reserve_seats(self):
        for index in range(3):
            User.objects.create_user(f'inactive-{index}@contracts.example.test', organization=self.org, is_active=False)
        invite = InvitationToken.create_invitation(self.org, 'reserved@contracts.example.test')
        with self.assertRaises(QuotaExceededException):
            check_member_capacity(self.org)
        check_member_capacity(self.org, invitation=invite)
        invite.expires_at = timezone.now() - timedelta(seconds=1)
        invite.save()
        check_member_capacity(self.org)

    def test_acceptance_replaces_reservation_and_cannot_be_reused(self):
        for index in range(3):
            User.objects.create_user(f'occupied-{index}@contracts.example.test', organization=self.org)
        invite = InvitationToken.create_invitation(self.org, 'accepted@contracts.example.test')
        self.client.force_authenticate(None)
        payload = {'token': invite.token, 'password': 'New-Participant-Test-927!'}
        response = self.client.post('/api/v1/organizations/invitations/accept/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(QuotaService.get_usage_summary(self.org)['usage']['team_members']['current'], 5)
        self.assertEqual(self.client.post('/api/v1/organizations/invitations/accept/', payload, format='json').status_code, 400)

    def test_resend_invitation_uses_public_url_without_duplicate_slash(self):
        from notifications.models import NotificationChannel
        NotificationChannel.objects.create(organization=self.org, name='Controlled email', channel_type='email', config={})
        invitation = InvitationToken.create_invitation(self.org, 'resend@contracts.example.test')
        with patch('notifications.services.EmailDeliveryHandler.send', return_value=True) as send:
            response = self.client.post(f'/api/v1/organizations/members/{invitation.pk}/resend/')
        self.assertEqual(response.status_code, 200)
        message = send.call_args.args[1].message
        self.assertIn('https://sentinel.example.test/accept-invitation#token=', message)
        self.assertNotIn('https://sentinel.example.test//', message)

    def test_invalid_public_url_does_not_create_or_extend_invitation(self):
        from notifications.models import NotificationChannel
        NotificationChannel.objects.create(organization=self.org, name='Controlled email', channel_type='email', config={})
        invitation = InvitationToken.create_invitation(self.org, 'unchanged@contracts.example.test')
        original_expiry = invitation.expires_at
        with override_settings(PUBLIC_APP_URL='invalid'), patch('notifications.services.EmailDeliveryHandler.send') as send:
            response = self.client.post('/api/v1/organizations/members/', {'email':'not-created@contracts.example.test'}, format='json')
            self.assertEqual(response.status_code, 503)
            self.assertFalse(InvitationToken.objects.filter(email='not-created@contracts.example.test').exists())
            response = self.client.post(f'/api/v1/organizations/members/{invitation.pk}/resend/')
            self.assertEqual(response.status_code, 503)
            send.assert_not_called()
        invitation.refresh_from_db()
        self.assertEqual(invitation.expires_at, original_expiry)

    def test_invitation_validation_accepts_body_and_ignores_stale_bearer(self):
        invite = InvitationToken.create_invitation(self.org, 'validate@contracts.example.test')
        anonymous = APIClient()
        response = anonymous.post('/api/v1/organizations/invitations/validate/', {'token': invite.token},
                                  format='json', HTTP_AUTHORIZATION='Bearer invalid')
        self.assertEqual(response.status_code, 200)
        invite.refresh_from_db()
        self.assertFalse(invite.is_used)

    def test_free_direct_create_rejects_existing_and_inactive_seat(self):
        self.org.plan_tier = 'free'
        self.org.save()
        self.admin.is_active = False
        self.admin.save()
        with self.assertRaises(QuotaExceededException), patch('accounts.beta.new_challenge'):
            UserService.create_user('extra@contracts.example.test', 'Participant-Test-927!', self.org.pk)

    def test_subscription_blocks_alternative_admission_paths(self):
        from ssl_monitor.services import SSLMonitorService
        from common.subscriptions import SubscriptionRequired
        for beta in (False, True):
            self.org.beta_managed = beta
            self.org.subscription_status = 'past_due'
            self.org.save()
            with self.subTest(beta=beta), self.assertRaises(SubscriptionRequired):
                SSLMonitorService.get_or_create_certificate(self.org.pk, 'restricted.example.test')

    def test_quota_infrastructure_error_never_counts_as_zero(self):
        from ssl_monitor.services import SSLMonitorService
        from ssl_monitor.models import SSLCertificate
        with patch.object(QuotaService, 'get_usage_summary', side_effect=RuntimeError('controlled outage')):
            with self.assertRaises(RuntimeError):
                SSLMonitorService.create_certificate(self.org.pk, 'not-created.example.test')
        self.assertFalse(SSLCertificate.objects.filter(organization=self.org).exists())

    def test_existing_ssl_identity_does_not_consume_another_slot(self):
        from ssl_monitor.services import SSLMonitorService
        from ssl_monitor.models import SSLCertificate
        self.org.plan_tier = 'free'
        self.org.save()
        for index in range(self.org.get_plan_limits()['max_ssl_certificates']):
            SSLCertificate.objects.create(organization=self.org, domain=f'existing-{index}.example.test')
        with patch('ssl_monitor.tasks.scan_ssl_certificate.delay'):
            cert = SSLMonitorService.create_certificate(self.org.pk, 'https://existing-0.example.test/path')
        self.assertEqual(cert.domain, 'existing-0.example.test')
        self.assertEqual(SSLCertificate.objects.filter(organization=self.org).count(), 2)

    def test_retention_ceiling_requires_explicit_activation(self):
        self.org.metrics_retention_days = 90
        for plan, beta, limit in [('free', True, 3), ('free', False, 7), ('pro', False, 30)]:
            self.org.plan_tier, self.org.beta_managed = plan, beta
            with self.subTest(plan=plan, beta=beta), override_settings(RETENTION_PLAN_CAP_ENFORCED=False):
                policy = retention_policy(self.org)
                self.assertEqual((policy['applied_days'], policy['planned_days']), (90, limit))
                self.assertTrue(policy['review_required'])
            with override_settings(RETENTION_PLAN_CAP_ENFORCED=True):
                self.assertEqual(retention_policy(self.org)['applied_days'], limit)

    def test_new_retention_values_cannot_exceed_contract(self):
        from organizations.serializers import OrganizationUpdateSerializer
        for plan, beta, limit in [('free', True, 3), ('free', False, 7), ('pro', False, 30)]:
            self.org.plan_tier, self.org.beta_managed = plan, beta
            with self.subTest(plan=plan, beta=beta):
                self.assertFalse(OrganizationUpdateSerializer(data={'metrics_retention_days': limit + 1},
                                 context={'organization': self.org}).is_valid())
                self.assertTrue(OrganizationUpdateSerializer(data={'metrics_retention_days': limit},
                                 context={'organization': self.org}).is_valid())

    def test_rule_patch_validates_complete_result_and_allows_global_target(self):
        from alerts.services import AlertRuleService
        from monitoring.models import MonitoringTarget
        target = MonitoringTarget.objects.create(organization=self.org, name='Controlled', endpoint='https://example.test')
        rule = AlertRuleService.create_rule(self.org.pk, 'Rule', 'monitoring', 'status_down', target_id=target.pk)
        with self.assertRaises(ValueError):
            AlertRuleService.update_rule(rule.pk, self.org.pk, condition='ssl_expiring')
        rule = AlertRuleService.update_rule(rule.pk, self.org.pk, target_id=None)
        self.assertIsNone(rule.target_id)

    def test_service_retention_validation_and_new_org_defaults(self):
        from organizations.services import OrganizationService
        for plan, days in [('free', 7), ('pro', 30)]:
            org = OrganizationService.create_organization(f'New {plan}', f'new-{plan}', plan_tier=plan)
            self.assertEqual(org.metrics_retention_days, days)
            with self.assertRaises(ValueError):
                OrganizationService.update_organization(org.pk, metrics_retention_days=days + 1)

    def test_retention_dry_run_is_capped_but_actual_purge_remains_legacy(self):
        from io import StringIO
        from django.core.management import call_command
        from monitoring.models import MonitoringTarget, MonitoringCheck
        self.org.plan_tier = 'free'
        self.org.metrics_retention_days = 90
        self.org.save()
        target = MonitoringTarget.objects.create(organization=self.org, name='Retained', endpoint='https://example.test')
        check = MonitoringCheck.objects.create(target=target, status='up', latency=10, checked_at=timezone.now())
        MonitoringCheck.objects.filter(pk=check.pk).update(checked_at=timezone.now()-timedelta(days=10))
        output = StringIO()
        with override_settings(RETENTION_PLAN_CAP_ENFORCED=False):
            call_command('purge_telemetry', dry_run=True, stdout=output)
            self.assertIn('retention_days=7 configured_days=90', output.getvalue())
            self.assertIn('monitoring_checks=1', output.getvalue())
            self.assertTrue(MonitoringCheck.objects.filter(pk=check.pk).exists())
            call_command('purge_telemetry', stdout=StringIO())
            self.assertTrue(MonitoringCheck.objects.filter(pk=check.pk).exists())
        with override_settings(RETENTION_PLAN_CAP_ENFORCED=True):
            call_command('purge_telemetry', stdout=StringIO())
            self.assertFalse(MonitoringCheck.objects.filter(pk=check.pk).exists())
        self.org.refresh_from_db()
        self.assertEqual(self.org.metrics_retention_days, 90)
        self.assertTrue(MonitoringTarget.objects.filter(pk=target.pk).exists())

    def test_malformed_audit_filters_reject_without_500(self):
        for query in ('limit=501', 'user_id=not-a-uuid', 'action=%3Cinvalid%3E', 'module=bad%20filter'):
            with self.subTest(query=query):
                self.assertEqual(self.client.get('/api/v1/audit-logs/?'+query).status_code, 400)

    def test_only_platform_administration_can_read_global_audit(self):
        from audit.models import AuditLog
        entry = AuditLog.objects.create(action='config_change', module='beta', description='Platform marker')
        self.assertEqual(self.client.get('/api/v1/platform-admin/audit-logs/').status_code, 403)
        self.admin.is_superuser = True
        self.admin.save()
        self.assertEqual(self.client.get('/api/v1/platform-admin/audit-logs/').status_code, 200)
        self.assertNotIn(str(entry.pk), str(self.client.get('/api/v1/audit-logs/').data))

    def test_empty_timeseries_has_nullable_metrics(self):
        from monitoring.models import MonitoringTarget
        from monitoring.services import MonitoringService
        target = MonitoringTarget.objects.create(organization=self.org, name='No data', endpoint='https://example.test')
        response = self.client.get(f'/api/v1/monitoring/{target.pk}/timeseries/')
        self.assertEqual(response.status_code, 200)
        summary = response.data['data']['summary']
        self.assertEqual(summary['total_checks'], 0)
        self.assertIsNone(summary['uptime_percentage'])
        self.assertIsNone(summary['avg_latency'])

    def test_agent_malformed_batch_does_not_consume_valid_reservation(self):
        from monitoring.models import MonitoringTarget, MonitoringCheck
        from monitoring.services import AgentProbeService
        from common.models import ScanLease
        probe, token = AgentProbeService.create_probe(self.org.pk, 'Batch probe')
        target = MonitoringTarget.objects.create(organization=self.org, name='Private', endpoint='10.0.0.1:80',
            target_type='tcp', runner_type='agent', agent_probe=probe, interval=60)
        AgentProbeService.process_heartbeat(probe)
        before = list(ScanLease.objects.values())
        self.client.force_authenticate(None)
        response = self.client.post('/api/v1/agent-probes/submit-results/', {'results': [
            {'target_id': str(target.pk), 'status': 'up', 'response_time_ms': 1}, 'malformed']},
            format='json', HTTP_X_PROBE_TOKEN=token)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MonitoringCheck.objects.filter(target=target).exists())
        self.assertEqual(list(ScanLease.objects.values()), before)

    def test_existing_agent_zero_http_sentinel_is_supported(self):
        from monitoring.agent_payload import validated_results
        payload = {'target_id': str(self.org.pk), 'status': 'up', 'response_time_ms': 0, 'http_status': 0}
        self.assertEqual(validated_results([payload])[0]['http_status'], 0)
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            validated_results([{**payload, 'http_status': 99}])

    def test_agent_validation_rejects_entire_malformed_batch(self):
        from monitoring.agent_payload import validated_results
        from rest_framework.exceptions import ValidationError
        valid = {'target_id': str(self.org.pk), 'status': 'up', 'response_time_ms': 0}
        for bad in ('string', {**valid, 'response_time_ms': float('inf')},
                    {**valid, 'response_time_ms': -1}, {**valid, 'http_status': 700},
                    {**valid, 'target_id': 'bad'}, {**valid, 'status': 'fictional'}):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                validated_results([valid, bad])

    def test_readiness_does_not_depend_on_cache_backed_api_throttling(self):
        from contextlib import ExitStack
        with ExitStack() as stack:
            anon = stack.enter_context(patch('rest_framework.throttling.AnonRateThrottle.allow_request', side_effect=RuntimeError('cache unavailable')))
            user = stack.enter_context(patch('rest_framework.throttling.UserRateThrottle.allow_request', side_effect=RuntimeError('cache unavailable')))
            for name in ('database_ready', 'broker_ready', 'workers_ready'):
                stack.enter_context(patch(f'common.views_health.{name}', return_value=True))
            with patch('common.views_health.cache_ready', return_value=False):
                self.assertEqual(APIClient().get('/api/v1/health/').status_code, 503)
            anon.assert_not_called()
            user.assert_not_called()

    def test_readiness_timeout_is_below_compose_deadline(self):
        import time
        from threading import Event
        released = Event()
        finished = Event()
        def slow_probe():
            released.wait(8)
            finished.set()
            return True
        with patch('common.views_health.database_ready', return_value=True), \
             patch('common.views_health.cache_ready', return_value=True), \
             patch('common.views_health.workers_ready', return_value=True), \
             patch('common.views_health.broker_ready', side_effect=slow_probe):
            started = time.monotonic()
            try:
                response = self.client.get('/api/v1/health/')
                self.assertEqual(response.status_code, 503)
                self.assertLess(time.monotonic()-started, 4.8)
            finally:
                released.set()
                self.assertTrue(finished.wait(2))

    def test_readiness_concurrent_requests_share_dependency_probes(self):
        from threading import Event
        from concurrent.futures import ThreadPoolExecutor
        import time
        released = Event()
        started = Event()
        def broker():
            started.set()
            self.assertTrue(released.wait(3))
            return True
        with patch('common.views_health.database_ready', return_value=True), \
             patch('common.views_health.cache_ready', return_value=True), \
             patch('common.views_health.workers_ready', return_value=True), \
             patch('common.views_health.broker_ready', side_effect=broker) as checked:
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(lambda: APIClient().get('/api/v1/health/').status_code)
                self.assertTrue(started.wait(2))
                second = pool.submit(lambda: APIClient().get('/api/v1/health/').status_code)
                time.sleep(0.05)
                released.set()
                self.assertEqual((first.result(), second.result()), (200, 200))
            self.assertEqual(checked.call_count, 1)

    def test_worker_probe_is_cached_briefly(self):
        from common import views_health
        from config.celery import app
        previous = views_health._worker_result
        try:
            views_health._worker_result = (0, False)
            with patch.object(app.control, 'inspect') as inspect:
                inspect.return_value.ping.return_value = {'worker': {'ok': 'pong'}}
                self.assertTrue(views_health.workers_ready())
                self.assertTrue(views_health.workers_ready())
                inspect.assert_called_once_with(timeout=1)
        finally:
            views_health._worker_result = previous

    def test_readiness_requires_every_dependency_and_exposes_no_exception(self):
        from contextlib import ExitStack
        for failed in ('database_ready', 'cache_ready', 'broker_ready', 'workers_ready', None):
            with self.subTest(failed=failed), ExitStack() as stack:
                for name in ('database_ready', 'cache_ready', 'broker_ready', 'workers_ready'):
                    stack.enter_context(patch(f'common.views_health.{name}',
                        side_effect=RuntimeError('private-credential-marker') if name == failed else None,
                        return_value=True))
                response = self.client.get('/api/v1/health/')
                self.assertEqual(response.status_code, 503 if failed else 200)
                self.assertNotIn('private-credential-marker', str(response.data))


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
                   PUBLIC_APP_URL='https://sentinel.example.test',
                   ENFORCE_LEGACY_EMAIL_VERIFICATION=False)
class HardeningConcurrency(TransactionTestCase):
    def setUp(self):
        from accounts.models import BetaControl
        BetaControl.objects.get_or_create(pk=1)

    def race(self, function):
        barrier = Barrier(2)
        def run(index):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return function(index)
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, (0, 1)))

    def test_concurrent_last_admin_deactivation_preserves_one(self):
        org = Organization.objects.create(name='Admin race', slug='admin-race', plan_tier='pro')
        admins = [User.objects.create_user(f'admin-{i}@race.example.test', organization=org,
                    is_staff=True, email_verified_at=timezone.now()) for i in range(2)]
        def deactivate(index):
            try:
                UserService.update_user(admins[index].pk, org.pk, is_active=False)
                return 'updated'
            except LastAdminRequired:
                return 'blocked'
        self.assertCountEqual(self.race(deactivate), ['updated', 'blocked'])
        self.assertEqual(User.objects.filter(organization=org, is_staff=True, is_active=True).count(), 1)

    def test_concurrent_direct_creation_respects_last_member_slot(self):
        org = Organization.objects.create(name='Seat race', slug='seat-race', plan_tier='pro')
        for index in range(4):
            User.objects.create_user(f'existing-{index}@race.example.test', organization=org)
        def create(index):
            try:
                UserService.create_user(f'new-{index}@race.example.test', 'Participant-Test-927!', org.pk)
                return 'created'
            except QuotaExceededException:
                return 'blocked'
        with patch('accounts.beta.new_challenge'):
            self.assertCountEqual(self.race(create), ['created', 'blocked'])
        self.assertEqual(User.objects.filter(organization=org).count(), 5)

    def test_concurrent_acceptance_consumes_invitation_only_once(self):
        org = Organization.objects.create(name='Invitation race', slug='invite-race', plan_tier='free')
        invitation = InvitationToken.create_invitation(org, 'accept@race.example.test')
        def accept(index):
            client = APIClient()
            return client.post('/api/v1/organizations/invitations/accept/',
                {'token': invitation.token, 'password': 'Participant-Test-927!'}, format='json').status_code
        self.assertCountEqual(self.race(accept), [200, 400])
        self.assertEqual(User.objects.filter(organization=org).count(), 1)
