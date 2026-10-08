from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from common.models import ScanLease
from common.scan_serializers import availability, resource_key
from monitoring.models import MonitoringTarget
from organizations.models import Organization


class ScanAvailabilityTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Availability', slug='availability')
        self.admin = User.objects.create_user(email='availability@example.test', password='test', organization=self.org, is_staff=True)
        self.target = MonitoringTarget.objects.create(organization=self.org, name='Public', endpoint='https://example.com', interval=60)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.now = timezone.now()

    def test_seven_states_and_precedence(self):
        lease = ScanLease(organization=self.org, resource_key=resource_key(self.target), pending_until=self.now + timedelta(minutes=1))
        self.assertEqual(availability(self.target, self.admin, now=self.now)['status'], 'ready')
        self.target.last_checked_at = self.now
        cooldown = availability(self.target, self.admin, now=self.now)
        self.assertEqual(cooldown['status'], 'cooldown')
        self.assertEqual(cooldown['retry_after_seconds'], 300)
        self.assertEqual(availability(self.target, self.admin, lease, self.now)['status'], 'pending')
        self.target.runner_type = 'agent'
        self.assertEqual(availability(self.target, self.admin, lease, self.now)['status'], 'agent_managed')
        self.target.enabled = False
        self.assertEqual(availability(self.target, self.admin, lease, self.now)['status'], 'disabled')
        self.admin.is_staff = False
        self.assertEqual(availability(self.target, self.admin, lease, self.now)['status'], 'read_only')
        self.org.subscription_status = 'past_due'
        result = availability(self.target, self.admin, lease, self.now)
        self.assertEqual(result['status'], 'subscription_required')
        self.assertIsNone(result['retry_after_seconds'])
        self.assertIsNone(result['next_allowed_at'])

    def test_plan_floor_slower_intervals_and_lease_deadline(self):
        self.target.last_checked_at = self.now
        for plan, interval, expected in [('free', 60, 300), ('pro', 60, 60), ('pro', 600, 600)]:
            self.org.plan_tier = plan
            self.target.interval = interval
            self.assertEqual(availability(self.target, self.admin, now=self.now)['retry_after_seconds'], expected)
        lease = ScanLease(next_allowed_at=self.now + timedelta(seconds=900))
        self.assertEqual(availability(self.target, self.admin, lease, self.now)['retry_after_seconds'], 900)

    def test_reentering_modules_does_not_renew_the_scan_deadline(self):
        for plan, interval, elapsed, remaining in [('free', 60, 90, 210), ('pro', 60, 10, 50), ('pro', 600, 10, 590)]:
            with self.subTest(plan=plan, interval=interval):
                self.org.plan_tier = plan
                self.org.save()
                self.target.interval = interval
                self.target.last_checked_at = self.now - timedelta(seconds=elapsed)
                self.target.save()
                with patch('common.scan_serializers.timezone.now', return_value=self.now), patch('monitoring.tasks.run_monitoring_check.delay') as send:
                    for _ in range(3):
                        listing = self.client.get('/api/v1/monitoring/').data['data'][0]['scan_availability']
                        detail = self.client.get(f'/api/v1/monitoring/{self.target.pk}/').data['data']['scan_availability']
                        self.assertEqual(listing, detail)
                        self.assertEqual(detail['retry_after_seconds'], remaining)
                        self.assertEqual(detail['next_allowed_at'], (self.now + timedelta(seconds=remaining)).isoformat())
                    send.assert_not_called()
                self.target.refresh_from_db()
                self.assertEqual(self.target.last_checked_at, self.now - timedelta(seconds=elapsed))
                self.assertFalse(ScanLease.objects.exists())

    def test_get_is_read_only_tenant_isolated_and_contains_no_reservation_secrets(self):
        other = Organization.objects.create(name='Other', slug='other-availability')
        foreign = MonitoringTarget.objects.create(organization=other, name='Foreign', endpoint='https://example.com')
        with patch('monitoring.tasks.run_monitoring_check.delay') as send:
            response = self.client.get('/api/v1/monitoring/')
            detail = self.client.get(f'/api/v1/monitoring/{self.target.pk}/')
            send.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ScanLease.objects.count(), 0)
        items = response.data['data']
        self.assertEqual(len(items), 1)
        self.assertEqual(set(items[0]['scan_availability']), {'status', 'next_allowed_at', 'retry_after_seconds'})
        self.assertEqual(detail.data['data']['scan_availability']['status'], 'ready')
        self.assertEqual(self.client.get(f'/api/v1/monitoring/{foreign.pk}/').status_code, 404)

    def test_list_queries_do_not_grow_per_resource(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from monitoring.serializers import MonitoringTargetSerializer
        from types import SimpleNamespace
        context = {'request': SimpleNamespace(user=self.admin)}
        with CaptureQueriesContext(connection) as small:
            MonitoringTargetSerializer(MonitoringTarget.objects.filter(organization=self.org), many=True, context=context).data
        MonitoringTarget.objects.bulk_create([MonitoringTarget(organization=self.org, name=f'Target {i}', endpoint='https://example.com') for i in range(20)])
        with CaptureQueriesContext(connection) as large:
            MonitoringTargetSerializer(MonitoringTarget.objects.filter(organization=self.org), many=True, context={'request': context['request']}).data
        self.assertEqual(len(small), len(large))

    def test_metadata_on_each_module_list_and_detail_and_viewer(self):
        from api_checks.models import APICheckTarget
        from ssl_monitor.models import SSLCertificate
        from dns_monitor.models import DNSRecord
        from domain.models import DomainInfo
        from security_headers.models import SecurityHeaderTarget
        resources = [
            ('monitoring', self.target),
            ('api-checks', APICheckTarget.objects.create(organization=self.org, name='API', url='https://example.com')),
            ('ssl-certificates', SSLCertificate.objects.create(organization=self.org, domain='example.com')),
            ('dns-records', DNSRecord.objects.create(organization=self.org, domain='example.com', record_type='A')),
            ('domains', DomainInfo.objects.create(organization=self.org, domain='example.com')),
            ('security-headers', SecurityHeaderTarget.objects.create(organization=self.org, name='Headers', url='https://example.com')),
        ]
        for route, resource in resources:
            with self.subTest(route=route):
                listing = self.client.get(f'/api/v1/{route}/')
                detail = self.client.get(f'/api/v1/{route}/{resource.pk}/')
                self.assertEqual(listing.status_code, 200)
                self.assertEqual(detail.status_code, 200)
                self.assertEqual(listing.data['data'][0]['scan_availability']['status'], 'ready')
                self.assertEqual(detail.data['data']['scan_availability']['status'], 'ready')
        self.admin.is_staff = False
        self.admin.save()
        for route, resource in resources:
            self.assertEqual(self.client.get(f'/api/v1/{route}/{resource.pk}/').data['data']['scan_availability']['status'], 'read_only')
        self.assertEqual(ScanLease.objects.count(), 0)

    def test_read_only_api_token_and_no_secrets_in_lease_snapshot(self):
        from accounts.models import APIToken
        import hashlib
        raw = 'snt_availability-test'
        APIToken.objects.create(user=self.admin, name='Read only', token_hash=hashlib.sha256(raw.encode()).hexdigest(), token_prefix=raw[:12], scope='read')
        ScanLease.objects.create(organization=self.org, resource_key=resource_key(self.target), pending_until=self.now + timedelta(minutes=1))
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')
        snapshot = self.client.get(f'/api/v1/monitoring/{self.target.pk}/').data['data']['scan_availability']
        self.assertEqual(snapshot['status'], 'read_only')
        self.assertEqual(set(snapshot), {'status','next_allowed_at','retry_after_seconds'})
