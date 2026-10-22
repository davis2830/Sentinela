from datetime import timedelta
from datetime import datetime, timezone as datetime_timezone
from unittest.mock import patch
from django.test import TestCase
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from organizations.models import Organization
from monitoring.models import MonitoringTarget, MonitoringCheck
from monitoring.services import MonitoringService
from monitoring.serializers import MonitoringTargetCreateSerializer, MonitoringTargetUpdateSerializer
from security_headers.models import SecurityHeaderTarget
from security_headers.services import SecurityHeadersService


class MeasurementCriteriaTests(TestCase):
    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(name='Criteria', slug='criteria')
        self.other = Organization.objects.create(name='Other criteria', slug='other-criteria')
        self.target = MonitoringTarget.objects.create(organization=self.org, name='Web', endpoint='https://example.test', max_latency_ms=2000, interval=60)
        now = timezone.now() - timedelta(minutes=20)
        self.base = now.replace(minute=now.minute // 10 * 10, second=10, microsecond=0)

    def check(self, status, latency, offset=0, target=None):
        return MonitoringCheck.objects.create(target=target or self.target, status=status, latency=latency, checked_at=self.base+timedelta(seconds=offset))

    def metrics(self):
        return MonitoringService.get_timeseries_metrics(self.target.id, self.org.id)

    def test_recorded_healthy_latency_above_300_is_not_reclassified(self):
        self.check('up', 1000)
        self.target.max_latency_ms = 50
        self.target.save(update_fields=['max_latency_ms'])
        data = self.metrics()
        self.assertEqual([p['status'] for p in data['timeseries'] if p['total_count']], ['up'])
        self.assertEqual([d['status'] for d in data['daily_availability'] if d['total_checks']], ['operational'])

    def test_recorded_slow_survives_low_average_and_threshold_change(self):
        self.check('slow', 100)
        self.check('up', 1, 20)
        data = self.metrics()
        self.assertEqual([p['status'] for p in data['timeseries'] if p['total_count']], ['slow'])
        self.assertEqual([d['status'] for d in data['daily_availability'] if d['total_checks']], ['degraded'])
        self.assertEqual(data['summary']['uptime_percentage'], 100)

    def test_failure_takes_precedence_and_missing_samples_are_neutral(self):
        self.check('up', 100)
        self.check('slow', 100, 10)
        self.check('error', None, 20)
        data = self.metrics()
        self.assertEqual([p['status'] for p in data['timeseries'] if p['total_count']], ['down'])
        for point in data['timeseries']:
            if not point['total_count']:
                self.assertEqual(point['status'], 'no_data')
                self.assertIsNone(point['latency'])
        for day in data['daily_availability']:
            if not day['total_checks']:
                self.assertIsNone(day['avg_latency'])

    def test_global_outcomes_use_recorded_states_and_tenant_scope(self):
        self.check('up', 1500)
        self.check('slow', 100, 10)
        self.check('error', None, 20)
        foreign = MonitoringTarget.objects.create(organization=self.other, name='Other', endpoint='https://other.test')
        self.check('down', 1, target=foreign)
        data = MonitoringService.get_organization_global_performance(self.org.id)
        summary = data['summary']
        self.assertEqual((summary['operational_checks'],summary['degraded_checks'],summary['failed_checks']), (1,1,1))
        self.assertEqual(summary['operational_percentage'], 33.33)
        self.assertEqual(sum(p['failed_checks'] for p in data['points']), 1)
        self.assertEqual(MonitoringService.get_organization_global_performance(self.other.id)['summary']['total_checks'], 1)

    def test_empty_global_has_no_compliance_percentage(self):
        data = MonitoringService.get_organization_global_performance(self.org.id)
        self.assertIsNone(data['summary']['operational_percentage'])
        self.assertIsNone(data['summary']['avg_latency'])
        self.assertEqual(data['summary']['operational_checks'], 0)

    def test_calendar_today_matches_local_day_before_utc_midnight_boundary(self):
        now = datetime(2026, 10, 22, 2, tzinfo=datetime_timezone.utc)
        with timezone.override('America/Guatemala'), patch('monitoring.services.timezone.now', return_value=now):
            MonitoringCheck.objects.create(target=self.target, status='up', latency=100,
                                           checked_at=now-timedelta(minutes=5))
            today = self.metrics()['daily_availability'][-1]
        self.assertEqual(today['date'], '2026-10-21')
        self.assertEqual(today['status'], 'operational')

    def test_positive_latency_threshold_required_by_both_write_serializers(self):
        for cls in (MonitoringTargetCreateSerializer, MonitoringTargetUpdateSerializer):
            field = cls().fields['max_latency_ms']
            for invalid in (0, -1):
                with self.assertRaises(ValidationError):
                    field.run_validation(invalid)
            self.assertEqual(field.run_validation(1), 1)
            self.assertEqual(field.run_validation(2000), 2000)

    def test_security_operational_bands_keep_unknown_separate_and_letters_intact(self):
        for i, (score, measured, leak) in enumerate([(70,True,False),(69,True,False),(50,True,False),(49,True,False),(80,True,True),(90,False,False),(None,False,False)]):
            SecurityHeaderTarget.objects.create(organization=self.org,name=f'headers-{i}',url=f'https://{i}.test',last_score=score,last_checked_at=timezone.now() if measured else None,info_leak_detected=leak)
        data = SecurityHeadersService.get_security_header_stats(self.org.id)
        self.assertEqual((data['healthy'],data['warning'],data['critical'],data['unmeasured']), (1,3,1,2))
        self.assertIn('grade_a', data)
