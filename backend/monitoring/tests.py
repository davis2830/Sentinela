from django.test import TestCase
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from io import StringIO
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization, OrganizationPlanTier

from .models import MonitoringCheck, MonitoringTarget
from .services import MonitoringService
from api_checks.models import APICheckTarget, APICheckResult
from audit.models import AuditLog


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

    @patch('common.security.validate_safe_public_url')
    @patch('common.safe_http.request')
    def test_diagnostic_reports_redirect_without_visiting_location(self, request_mock, validate_mock):
        request_mock.return_value.status_code = 308
        request_mock.return_value.is_redirect = True
        request_mock.return_value.headers = {'Location': 'http://127.0.0.1/private'}
        response = self.client.post('/api/v1/monitoring/test-connection/', {
            'endpoint': 'https://example.com', 'target_type': 'https',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['status_code'], 308)
        self.assertEqual(response.data['data']['redirect_location'], 'http://127.0.0.1/private')
        self.assertEqual(response.data['data']['status'], 'down')
        request_mock.assert_called_once()
        self.assertEqual(request_mock.call_args.kwargs['url'], 'https://example.com')

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
            {"name": "Sixth", "target_type": "https", "endpoint": "https://8.8.8.8", "interval": 300},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["errors"]["code"], "QUOTA_EXCEEDED")
        self.assertEqual(MonitoringTarget.objects.filter(organization=self.org).count(), 5)

    def test_free_plan_rejects_interval_below_five_minutes(self):
        response = self.client.post(
            "/api/v1/monitoring-targets/",
            {"name": "Fast", "target_type": "https", "endpoint": "https://8.8.8.8", "interval": 60},
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

    @patch("monitoring.tasks.run_monitoring_check.delay")
    def test_individual_scan_returns_queued_contract_without_stale_resource(self, delay):
        delay.return_value.id = "task-123"
        target = MonitoringTarget.objects.create(
            organization=self.org,
            name="Queued",
            endpoint="https://example.com",
            last_status="down",
            last_checked_at=timezone.now() - timedelta(hours=1),
        )
        response = self.client.post(f"/api/v1/monitoring-targets/{target.id}/scan/")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(
            set(response.data["data"]),
            {"task_id", "resource_id", "status", "submitted_at"},
        )
        self.assertEqual(response.data["data"]["task_id"], "task-123")
        self.assertEqual(response.data["data"]["resource_id"], str(target.id))
        self.assertEqual(response.data["data"]["status"], "queued")


class GlobalPerformanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(name="Metrics Alpha", slug="metrics-alpha")
        self.other_org = Organization.objects.create(name="Metrics Beta", slug="metrics-beta")

    def test_empty_period_has_no_availability_or_latency(self):
        result = MonitoringService.get_organization_global_performance(self.org.id, "1h")
        self.assertEqual(result["summary"]["avg_uptime"], 100.0)
        self.assertEqual(result["summary"]["avg_latency"], 0)
        self.assertEqual(result["summary"]["total_checks"], 0)
        self.assertTrue(all(point["requests"] == 0 for point in result["points"]))

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
        self.assertEqual(sum(point["requests"] for point in result["points"]), 2)

    def test_period_changes_historical_metrics(self):
        target = MonitoringTarget.objects.create(organization=self.org, name="Web", endpoint="https://alpha.example.test")
        MonitoringCheck.objects.create(
            target=target, status="up", latency=120,
            checked_at=timezone.now() - timedelta(hours=2),
        )

        last_hour = MonitoringService.get_organization_global_performance(self.org.id, "1h")
        last_day = MonitoringService.get_organization_global_performance(self.org.id, "24h")
        self.assertEqual(last_hour["summary"]["total_checks"], 0)
        self.assertEqual(last_day["summary"]["avg_uptime"], 100)
        self.assertEqual(last_day["summary"]["total_checks"], 1)


class HardeningCommandTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Retention",
            slug="retention",
            metrics_retention_days=30,
        )

    def test_quarantine_is_dry_run_by_default_and_idempotent_on_apply(self):
        unsafe = APICheckTarget.objects.create(
            organization=self.org,
            name="Internal API",
            url="http://127.0.0.1:8000/health/",
        )
        output = StringIO()
        call_command("quarantine_unsafe_targets", stdout=output)
        unsafe.refresh_from_db()
        self.assertTrue(unsafe.enabled)
        self.assertEqual(AuditLog.objects.count(), 0)

        call_command("quarantine_unsafe_targets", apply=True, operator="security@example.test")
        unsafe.refresh_from_db()
        self.assertFalse(unsafe.enabled)
        self.assertEqual(AuditLog.objects.filter(module="api_check").count(), 1)

        call_command("quarantine_unsafe_targets", apply=True, operator="security@example.test")
        self.assertEqual(AuditLog.objects.filter(module="api_check").count(), 1)

    def test_retention_deletes_history_but_preserves_configuration(self):
        target = MonitoringTarget.objects.create(
            organization=self.org,
            name="Web",
            endpoint="https://example.com",
        )
        old = timezone.now() - timedelta(days=31)
        check = MonitoringCheck.objects.create(target=target, status="up", checked_at=old)
        api_target = APICheckTarget.objects.create(
            organization=self.org,
            name="API",
            url="https://example.com/api",
        )
        result = APICheckResult.objects.create(
            target=api_target,
            status="pass",
            http_status=200,
            response_time_ms=10,
            json_valid=True,
            schema_valid=True,
            headers_valid=True,
            checked_at=old,
        )

        call_command("purge_telemetry")
        self.assertFalse(MonitoringCheck.objects.filter(id=check.id).exists())
        self.assertFalse(APICheckResult.objects.filter(id=result.id).exists())
        self.assertTrue(MonitoringTarget.objects.filter(id=target.id).exists())
        self.assertTrue(APICheckTarget.objects.filter(id=api_target.id).exists())
