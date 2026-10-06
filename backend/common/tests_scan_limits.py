from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch, ANY

from django.db import connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from monitoring.models import MonitoringTarget, AgentProbe
from monitoring.tasks import run_monitoring_check, schedule_all_checks
from monitoring.services import AgentProbeService
from api_checks.models import APICheckTarget
from ssl_monitor.models import SSLCertificate
from dns_monitor.models import DNSRecord
from domain.models import DomainInfo
from security_headers.models import SecurityHeaderTarget
from common.models import ScanLease
from common.scan_limits import reserve, ScanLimited, enqueue_scan


class ScanLimitTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Scan floor', slug='scan-floor')
        self.admin = User.objects.create_user(email='scan@example.test', password='Test-pass', organization=self.org, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.target = MonitoringTarget.objects.create(organization=self.org, name='Public', endpoint='https://example.com', interval=60)

    def test_free_pro_and_slower_resource_cooldowns(self):
        for plan, interval, elapsed, allowed in [('free', 60, 100, False), ('pro', 60, 100, True), ('pro', 600, 100, False)]:
            with self.subTest(plan=plan, interval=interval):
                ScanLease.objects.all().delete()
                self.org.plan_tier = plan
                self.org.save()
                self.target.interval = interval
                self.target.last_checked_at = timezone.now() - timedelta(seconds=elapsed)
                self.target.save()
                with patch('monitoring.tasks.run_monitoring_check.delay') as send:
                    send.return_value.id = 'test-task'
                    response = self.client.post(f'/api/v1/monitoring/{self.target.id}/scan/')
                self.assertEqual(response.status_code, 202 if allowed else 429)
                self.assertEqual(send.call_count, 1 if allowed else 0)
                if not allowed:
                    self.assertGreater(int(response['Retry-After']), 0)
                    self.assertIn('Podrás comprobarlo nuevamente', str(response.data['message']))

    def test_pending_blocks_alias_bulk_and_scheduler(self):
        with patch('monitoring.tasks.run_monitoring_check.delay') as send:
            send.return_value.id = 'test-task'
            first = self.client.post(f'/api/v1/monitoring/{self.target.id}/scan/')
            self.assertEqual(first.status_code, 202)
            self.assertEqual(self.client.post(f'/api/v1/monitoring-targets/{self.target.id}/scan/').status_code, 429)
            bulk = self.client.post('/api/v1/monitoring/bulk-action/', {'action': 'scan', 'target_ids': [str(self.target.id)]}, format='json')
            self.assertEqual(bulk.data['data']['queued_count'], 0)
            schedule_all_checks.run()
            self.assertEqual(send.call_count, 1)

    def test_bulk_scan_never_dispatches_another_tenant(self):
        other = Organization.objects.create(name='Other scans', slug='other-scans')
        MonitoringTarget.objects.create(organization=other, name='Foreign', endpoint='https://example.com')
        with patch('monitoring.tasks.run_monitoring_check.delay') as send:
            response = self.client.post('/api/v1/monitoring/scan-all/')
        self.assertEqual(response.data['data']['queued_count'], 1)
        send.assert_called_once_with(str(self.target.id), scan_token=ANY)

    def test_all_modules_share_the_same_admission_rule(self):
        resources = [
            ('api-checks', APICheckTarget.objects.create(organization=self.org, name='API', url='https://example.com', last_checked_at=timezone.now())),
            ('ssl-certificates', SSLCertificate.objects.create(organization=self.org, domain='example.com', last_scanned_at=timezone.now())),
            ('dns-records', DNSRecord.objects.create(organization=self.org, domain='example.com', record_type='A', last_scanned_at=timezone.now())),
            ('domains', DomainInfo.objects.create(organization=self.org, domain='example.com', last_scanned_at=timezone.now())),
            ('security-headers', SecurityHeaderTarget.objects.create(organization=self.org, name='Headers', url='https://example.com', last_checked_at=timezone.now())),
        ]
        for route, resource in resources:
            with self.subTest(route=route):
                self.assertEqual(self.client.post(f'/api/v1/{route}/{resource.id}/scan/').status_code, 429)
                bulk = self.client.post(f'/api/v1/{route}/scan-all/')
                self.assertEqual(bulk.status_code, 200)
                self.assertEqual(bulk.data['data']['queued_count'], 0)

    def test_worker_duplicate_and_direct_execution_cannot_bypass_limit(self):
        token = reserve(self.target)
        with patch('monitoring.tasks._run_http_check', return_value=('up', 100, {})) as connect:
            run_monitoring_check.run(str(self.target.id), scan_token=token)
            run_monitoring_check.run(str(self.target.id), scan_token=token)
            run_monitoring_check.run(str(self.target.id))
            connect.assert_called_once()
        self.assertEqual(self.target.checks.count(), 1)

    def test_celery_task_signatures_accept_reservation_tokens(self):
        from api_checks.tasks import run_api_check
        from ssl_monitor.tasks import scan_ssl_certificate
        from dns_monitor.tasks import scan_dns_records
        from domain.tasks import scan_whois
        from security_headers.tasks import scan_security_headers
        for task in [run_monitoring_check, run_api_check, scan_ssl_certificate, scan_dns_records, scan_whois, scan_security_headers]:
            with self.subTest(task=task.name):
                task.__header__(str(self.target.id), scan_token='fixture-token')

    def test_broker_failure_releases_reservation(self):
        with patch('monitoring.tasks.run_monitoring_check.delay', side_effect=RuntimeError('broker unavailable')):
            with self.assertRaises(RuntimeError):
                enqueue_scan(self.target, run_monitoring_check)
        self.assertIsNotNone(reserve(self.target))

    def test_live_diagnostic_is_also_limited(self):
        with patch('common.security.validate_safe_public_url'), patch('common.safe_http.request') as connect:
            connect.return_value.status_code = 200
            connect.return_value.is_redirect = False
            connect.return_value.headers = {}
            first = self.client.post('/api/v1/monitoring/test-connection/', {'endpoint': 'https://example.com', 'target_type': 'https'}, format='json')
            second = self.client.post('/api/v1/monitoring/test-connection/', {'endpoint': 'https://other.example.com', 'target_type': 'https'}, format='json')
            self.assertEqual(first.status_code, 200)
            self.assertEqual(second.status_code, 429)
            connect.assert_called_once()

    def test_agent_heartbeat_and_result_duplicates_obey_reservation(self):
        probe = AgentProbe.objects.create(organization=self.org, name='Local', token_hash='b' * 64)
        self.target.runner_type = 'agent'
        self.target.agent_probe = probe
        self.target.save()
        self.assertEqual(len(AgentProbeService.process_heartbeat(probe)), 1)
        self.assertEqual(AgentProbeService.process_heartbeat(probe), [])
        result = [{'target_id': str(self.target.id), 'status': 'up', 'response_time_ms': 10}]
        self.assertEqual(AgentProbeService.ingest_results(probe, result), 1)
        self.assertEqual(AgentProbeService.ingest_results(probe, result), 0)
        self.assertEqual(AgentProbeService.process_heartbeat(probe), [])


class ConcurrentScanTests(TransactionTestCase):
    def test_two_simultaneous_reservations_admit_only_one(self):
        org = Organization.objects.create(name='Concurrent', slug='concurrent')
        target = MonitoringTarget.objects.create(organization=org, name='Concurrent target', endpoint='https://example.com')
        barrier = Barrier(2)

        def claim():
            try:
                resource = MonitoringTarget.objects.select_related('organization').get(pk=target.pk)
                barrier.wait(timeout=10)
                try:
                    reserve(resource)
                    return True
                except ScanLimited:
                    return False
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: claim(), range(2)))
        self.assertEqual(sorted(results), [False, True])
