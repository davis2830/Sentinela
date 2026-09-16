from django.test import TestCase
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization, OrganizationPlanTier

from .models import MonitoringCheck, MonitoringTarget
from .services import MonitoringService


class MonitoringAccessTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Alpha", slug="alpha", plan_tier=OrganizationPlanTier.FREE)
        self.other_org = Organization.objects.create(name="Beta", slug="beta")
        self.user = User.objects.create_user(
            email="alpha@example.test", password="test-pass", organization=self.org, is_staff=True
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.test", password="test-pass", organization=self.org
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_other_organization_target_is_hidden_and_cannot_be_changed(self):
        foreign = MonitoringTarget.objects.create(
            organization=self.other_org, name="Foreign", endpoint="https://beta.example.test"
        )
        own = MonitoringTarget.objects.create(
            organization=self.org, name="Own", endpoint="https://alpha.example.test"
        )

        listing = self.client.get("/api/v1/monitoring-targets/")
        self.assertEqual(listing.status_code, 200)
        ids = {item["id"] for item in listing.data["data"]}
        self.assertIn(str(own.id), ids)
        self.assertNotIn(str(foreign.id), ids)

        url = f"/api/v1/monitoring-targets/{foreign.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {"name": "Changed"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        foreign.refresh_from_db()
        self.assertEqual(foreign.name, "Foreign")

    def test_free_plan_rejects_sixth_target(self):
        for number in range(5):
            MonitoringTarget.objects.create(
                organization=self.org, name=f"Existing {number}", endpoint=f"https://{number}.example.test"
            )

        response = self.client.post(
            "/api/v1/monitoring-targets/",
            {"name": "Sixth", "target_type": "https", "endpoint": "https://sixth.example.test", "interval": 300},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["errors"]["code"], "QUOTA_EXCEEDED")
        self.assertEqual(MonitoringTarget.objects.filter(organization=self.org).count(), 5)

    def test_free_plan_rejects_interval_below_five_minutes(self):
        response = self.client.post(
            "/api/v1/monitoring-targets/",
            {"name": "Fast", "target_type": "https", "endpoint": "https://fast.example.test", "interval": 60},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["errors"]["resource"], "min_interval")
        self.assertFalse(MonitoringTarget.objects.filter(organization=self.org).exists())

    def test_viewer_can_read_but_cannot_change_or_bulk_pause_targets(self):
        target = MonitoringTarget.objects.create(
            organization=self.org, name="Own", endpoint="https://alpha.example.test"
        )
        self.client.force_authenticate(self.viewer)
        url = f"/api/v1/monitoring-targets/{target.id}/"

        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.patch(url, {"enabled": False}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        bulk = self.client.post(
            "/api/v1/monitoring-targets/bulk-action/",
            {"action": "pause", "target_ids": [str(target.id)]},
            format="json",
        )
        self.assertEqual(bulk.status_code, 403)
        target.refresh_from_db()
        self.assertTrue(target.enabled)


class GlobalPerformanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(name="Metrics Alpha", slug="metrics-alpha")
        self.other_org = Organization.objects.create(name="Metrics Beta", slug="metrics-beta")

    def test_empty_period_has_no_availability_or_latency(self):
        result = MonitoringService.get_organization_global_performance(self.org.id, "1h")
        self.assertIsNone(result["summary"]["avg_uptime"])
        self.assertIsNone(result["summary"]["avg_latency"])
        self.assertEqual(result["summary"]["checks_per_minute"], 0)
        self.assertTrue(all(point["uptime"] is None and point["latency"] is None and point["checks"] == 0 for point in result["points"]))

    def test_check_metrics_are_scoped_to_organization(self):
        target = MonitoringTarget.objects.create(organization=self.org, name="Web", endpoint="https://alpha.example.test")
        foreign = MonitoringTarget.objects.create(organization=self.other_org, name="Other", endpoint="https://beta.example.test")
        checked_at = timezone.now().replace(second=0, microsecond=0)
        MonitoringCheck.objects.create(target=target, status="up", latency=100, checked_at=checked_at)
        MonitoringCheck.objects.create(target=target, status="down", latency=300, checked_at=checked_at)
        MonitoringCheck.objects.create(target=foreign, status="up", latency=1, checked_at=checked_at)

        with patch("monitoring.services.timezone.now", return_value=checked_at + timedelta(seconds=2)):
            result = MonitoringService.get_organization_global_performance(self.org.id, "1h")
        self.assertEqual(result["summary"]["total_checks"], 2)
        self.assertEqual(result["summary"]["avg_uptime"], 50)
        self.assertEqual(result["summary"]["avg_latency"], 200)
        self.assertEqual(sum(point["checks"] for point in result["points"]), 2)
        self.assertGreater(result["points"][-1]["checks_per_minute"], 0)
        self.assertEqual(result["points"][-1]["checks"], 2)

    def test_period_changes_historical_metrics(self):
        target = MonitoringTarget.objects.create(organization=self.org, name="Web", endpoint="https://alpha.example.test")
        MonitoringCheck.objects.create(
            target=target, status="up", latency=120,
            checked_at=timezone.now() - timedelta(hours=2),
        )

        last_hour = MonitoringService.get_organization_global_performance(self.org.id, "1h")
        last_day = MonitoringService.get_organization_global_performance(self.org.id, "24h")
        self.assertIsNone(last_hour["summary"]["avg_uptime"])
        self.assertEqual(last_day["summary"]["avg_uptime"], 100)
        self.assertEqual(last_day["summary"]["total_checks"], 1)
