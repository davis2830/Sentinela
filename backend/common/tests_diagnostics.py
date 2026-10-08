from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accounts.beta_models import AbuseBucket
from common.diagnostics import admit, DiagnosticLimited, PREFIX
from common.models import ScanLease
from monitoring.models import MonitoringTarget, MonitoringCheck
from organizations.models import Organization

LOCAL_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'configuration-tests'}}


@override_settings(CACHES=LOCAL_CACHE)
class ConfigurationDiagnosticTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Diagnostics', slug='diagnostics')
        self.user = User.objects.create_user(email='diagnostic@example.test', password='Test-password', organization=self.org, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.preview = patch('monitoring.views.TestConnectionView.perform_diagnostic', side_effect=lambda request: self.result())
        self.perform = self.preview.start()
        self.addCleanup(self.preview.stop)

    @staticmethod
    def result():
        from common.responses import success_response
        return success_response({'status': 'up', 'headers': {'X-Test': 'secret-response'}, 'latency_ms': 42})

    def post(self, url='https://example.com', **kwargs):
        return self.client.post('/api/v1/monitoring/test-connection/', {'endpoint': url, 'target_type':'https', **kwargs}, format='json')

    def test_identical_safe_preview_reuses_encrypted_tenant_scoped_cache(self):
        from django.core.cache import cache
        first, second = self.post(), self.post()
        self.assertEqual(first.status_code, 200)
        self.assertTrue(second.data['diagnostic']['cached'])
        self.assertEqual(first.data['diagnostic']['checked_at'], second.data['diagnostic']['checked_at'])
        self.assertEqual(self.perform.call_count, 1)
        self.assertNotIn('secret-response', str(cache._cache))
        other = Organization.objects.create(name='Other', slug='diagnostics-other')
        self.user.organization = other
        self.user.save()
        self.assertFalse(self.post().data['diagnostic']['cached'])
        self.assertEqual(self.perform.call_count, 2)

    def test_three_requests_share_budget_across_modules_not_plan_cooldown(self):
        from common.responses import success_response
        with patch('ssl_monitor.views.SSLTestConnectionView.perform_diagnostic', return_value=success_response({})), patch('dns_monitor.views.DNSTestResolutionView.perform_diagnostic', return_value=success_response({})):
            self.assertEqual(self.post().status_code, 200)
            self.assertEqual(self.client.post('/api/v1/ssl-certificates/test-connection/', {'domain':'example.com'}, format='json').status_code, 200)
            self.assertEqual(self.client.post('/api/v1/dns-records/test-resolution/', {'domain':'example.com'}, format='json').status_code, 200)
            blocked = self.post('https://different.example.com')
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['errors']['code'], 'DIAGNOSTIC_RATE')
        self.assertIn('guardar el monitor', str(blocked.data['message']))
        self.assertLessEqual(int(blocked['Retry-After']), 60)

    def test_changed_credentials_never_reuse_another_configuration_result(self):
        self.post(custom_headers={'Authorization':'Bearer first-secret'})
        result = self.post(custom_headers={'Authorization':'Bearer second-secret'})
        self.assertFalse(result.data['diagnostic']['cached'])
        self.assertEqual(self.perform.call_count, 2)

    def test_expired_cache_metadata_requires_a_new_connection(self):
        now=timezone.now()
        self.post()
        with patch('common.diagnostics.timezone.now', return_value=now+timedelta(seconds=31)):
            result=self.post()
        self.assertFalse(result.data['diagnostic']['cached'])
        self.assertEqual(self.perform.call_count, 2)

    @override_settings(DIAGNOSTIC_PER_MINUTE=10, DIAGNOSTIC_FREE_DAILY=1, DIAGNOSTIC_PAID_DAILY=3)
    def test_paid_budget_is_separate_and_still_bounded(self):
        self.org.plan_tier='pro'
        self.org.save()
        for index in range(3):
            self.assertEqual(self.post(f'https://paid-{index}.example.com').status_code,200)
        self.assertEqual(self.post('https://paid-last.example.com').data['errors']['code'],'DIAGNOSTIC_DAILY')

    @override_settings(DIAGNOSTIC_PER_MINUTE=30)
    def test_free_daily_budget_is_twenty_even_outside_managed_beta(self):
        for index in range(20):
            self.assertEqual(self.post(f'https://endpoint-{index}.example.com').status_code, 200)
        blocked = self.post('https://last.example.com')
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['errors']['code'], 'DIAGNOSTIC_DAILY')

    @override_settings(DIAGNOSTIC_GLOBAL_PER_MINUTE=1)
    def test_global_capacity_applies_across_tenants(self):
        self.assertEqual(self.post().status_code, 200)
        self.user.organization = Organization.objects.create(name='Global other', slug='global-other')
        self.user.save()
        self.assertEqual(self.post('https://second.example.com').data['errors']['code'], 'DIAGNOSTIC_GLOBAL')

    def test_preview_does_not_change_telemetry_or_resource_reservation(self):
        target = MonitoringTarget.objects.create(organization=self.org, name='Existing', endpoint='https://example.com', last_checked_at=timezone.now(), interval=600)
        lease = ScanLease.objects.create(organization=self.org, resource_key=f'{self.org.pk}:monitoring.monitoringtarget:{target.pk}', next_allowed_at=timezone.now()+timedelta(seconds=600))
        original = lease.next_allowed_at
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.client.post(f'/api/v1/monitoring/{target.pk}/scan/').status_code, 429)
        lease.refresh_from_db()
        self.assertEqual(lease.next_allowed_at, original)
        self.assertEqual(MonitoringCheck.objects.count(), 0)
        self.assertIsNone(ScanLease.objects.get(resource_key=PREFIX+str(self.org.pk)).pending_until)

    def test_invalid_syntax_consumes_no_budget_or_reservation(self):
        for value in ['', 'https://', 'https://example.com:99999', 'https://exa mple.com']:
            self.assertEqual(self.post(value).status_code, 400)
        self.assertEqual(AbuseBucket.objects.count(), 0)
        self.assertEqual(ScanLease.objects.count(), 0)
        self.perform.assert_not_called()

    def test_mutating_http_methods_require_confirmation_and_are_never_reused(self):
        self.assertEqual(self.post(http_method='POST').status_code, 400)
        self.assertEqual(self.post(http_method='POST', confirm_side_effects=True).status_code, 200)
        self.assertEqual(self.post(http_method='POST', confirm_side_effects=True).status_code, 200)
        self.assertEqual(self.perform.call_count, 2)

    def test_cache_failure_does_not_disable_durable_limits(self):
        with patch('common.diagnostics.cache') as preview_cache:
            preview_cache.get.side_effect = RuntimeError('cache unavailable')
            for _ in range(3):
                self.assertEqual(self.post().status_code, 200)
            self.assertEqual(self.post().status_code, 429)

    def test_viewer_and_expired_subscription_cannot_reuse_cached_result(self):
        self.post()
        self.user.is_staff = False
        self.user.save()
        self.assertEqual(self.post().status_code, 403)
        self.user.is_staff = True
        self.user.save()
        self.org.subscription_status = 'past_due'
        self.org.save()
        self.assertEqual(self.post().status_code, 403)
        self.assertEqual(self.perform.call_count, 1)

    def test_exception_releases_capacity_and_pending_blocks_parallel_request(self):
        lease_id, token = admit(self.org)
        self.assertEqual(self.post().data['errors']['code'], 'DIAGNOSTIC_PENDING')
        ScanLease.objects.filter(pk=lease_id, token=token).update(pending_until=None)
        self.perform.side_effect = RuntimeError('failed preview')
        with self.assertRaises(RuntimeError):
            self.post()
        self.assertIsNone(ScanLease.objects.get(pk=lease_id).pending_until)


class DiagnosticConcurrencyTests(TransactionTestCase):
    @override_settings(DIAGNOSTIC_MAX_CONCURRENT=1)
    def test_global_concurrency_is_serialized_across_organizations(self):
        organizations=[Organization.objects.create(name=f'Global {i}',slug=f'global-diagnostic-{i}') for i in range(2)]
        barrier=Barrier(2)

        def attempt(org):
            try:
                barrier.wait(timeout=10)
                try:
                    admit(org)
                    return 'admitted'
                except DiagnosticLimited:
                    return 'limited'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(attempt,organizations)),['admitted','limited'])

    def test_two_database_connections_allow_only_one_preview_per_organization(self):
        org = Organization.objects.create(name='Concurrent diagnostic', slug='diagnostic-concurrent')
        barrier = Barrier(2)

        def attempt():
            try:
                current = Organization.objects.get(pk=org.pk)
                barrier.wait(timeout=10)
                try:
                    admit(current)
                    return 'admitted'
                except DiagnosticLimited:
                    return 'limited'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(lambda _: attempt(), range(2))), ['admitted', 'limited'])
