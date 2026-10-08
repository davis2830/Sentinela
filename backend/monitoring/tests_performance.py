from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from .models import MonitoringCheck, MonitoringTarget


class GlobalPerformanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(name="Performance", slug="performance-regression")
        user = User.objects.create_user(email="perf@example.test", password="test-pass", organization=self.org)
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.target = MonitoringTarget.objects.create(organization=self.org, name="Public", target_type="https", endpoint="https://example.com")
        self.now = datetime(2026, 10, 6, 12, 30, tzinfo=dt_timezone.utc)

    def get(self, period="24h"):
        with patch("monitoring.services.timezone.now", return_value=self.now):
            response = self.client.get("/api/v1/monitoring/global-performance/", {"period": period})
        self.assertEqual(response.status_code, 200)
        return response.data["data"]

    def test_empty_period_never_fabricates_uptime_or_latency(self):
        for period in ("1h", "6h", "24h", "7d"):
            data = self.get(period)
            self.assertIsNone(data["summary"]["avg_uptime"])
            self.assertIsNone(data["summary"]["avg_latency"])
            self.assertEqual(data["summary"]["checks_per_minute"], 0)
            for point in data["points"]:
                self.assertIsNone(point["uptime"])
                self.assertIsNone(point["latency"])
                self.assertEqual(point["checks"], 0)
                self.assertEqual(point["checks_per_minute"], 0)

    def test_counts_rates_and_partial_buckets_match_real_checks(self):
        MonitoringCheck.objects.create(target=self.target, status="up", latency=400, checked_at=self.now-timedelta(minutes=50))
        MonitoringCheck.objects.create(target=self.target, status="down", latency=800, checked_at=self.now-timedelta(minutes=10))
        data = self.get("24h")
        self.assertEqual(data["summary"]["total_checks"], 2)
        self.assertEqual(data["summary"]["avg_uptime"], 50)
        self.assertEqual(data["summary"]["avg_latency"], 600)
        measured = [p for p in data["points"] if p["checks"]]
        self.assertEqual(sum(p["checks"] for p in measured), 2)
        self.assertEqual(measured[-1]["checks_per_minute"], round(1/30, 6))
        self.assertTrue(all(p["latency"] is None for p in data["points"] if not p["checks"]))
        hourly = self.get("1h")
        self.assertEqual(hourly["summary"]["checks_per_minute"], round(2/60, 6))
        self.assertTrue(all(p["requests"] == p["checks"] for p in hourly["points"]))

    def test_foreign_future_and_expired_checks_are_excluded(self):
        foreign_org = Organization.objects.create(name="Other", slug="performance-other")
        foreign = MonitoringTarget.objects.create(organization=foreign_org, name="Other", target_type="https", endpoint="https://example.com")
        for target, when in [(foreign, self.now), (self.target, self.now+timedelta(minutes=1)), (self.target, self.now-timedelta(days=8))]:
            MonitoringCheck.objects.create(target=target, status="up", latency=50, checked_at=when)
        self.assertEqual(self.get("7d")["summary"]["total_checks"], 0)
