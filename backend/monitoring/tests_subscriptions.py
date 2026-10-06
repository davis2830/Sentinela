from datetime import timedelta
from unittest.mock import patch, ANY

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from organizations.services import OrganizationService
from common.subscriptions import monitoring_allowed, SubscriptionRequired
from monitoring.models import MonitoringTarget, AgentProbe
from monitoring.services import AgentProbeService
from monitoring.tasks import register_target_in_submonitors, run_monitoring_check, schedule_all_checks
from monitoring.discovery import coverage
from ssl_monitor.models import SSLCertificate
from ssl_monitor.tasks import scan_ssl_certificate
from dns_monitor.models import DNSRecord
from dns_monitor.tasks import scan_dns_records
from domain.models import DomainInfo
from domain.tasks import scan_whois
from api_checks.models import APICheckTarget
from api_checks.tasks import run_api_check, run_all_api_checks
from security_headers.models import SecurityHeaderTarget
from security_headers.tasks import scan_security_headers


class EntitlementTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Entitlements", slug="entitlements", plan_tier="pro", subscription_status="trialing")
        self.user = User.objects.create_user(email="entitlement@example.test", password="test-pass", organization=self.org, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def expire(self, status="past_due"):
        self.org.subscription_status = status
        self.org.trial_ends_at = timezone.now() - timedelta(seconds=1)
        self.org.save()

    def test_new_organization_receives_a_real_trial(self):
        self.assertTrue(monitoring_allowed(self.org))
        self.assertGreater(self.org.trial_ends_at, timezone.now() + timedelta(days=13))

    def test_expired_trial_blocks_without_daily_job(self):
        self.expire("trialing")
        response = self.client.post("/api/v1/monitoring/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["errors"]["code"], "SUBSCRIPTION_REQUIRED")
        self.assertIn("pago", response.data["message"])
        self.org.refresh_from_db()
        self.assertEqual(self.org.subscription_status, "trialing")

    def test_all_operational_apis_block_creation_and_scans_but_allow_reads(self):
        self.expire()
        for endpoint in ("monitoring", "monitoring-targets", "api-checks", "ssl-certificates", "dns-records", "domains", "security-headers", "agent-probes"):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(f"/api/v1/{endpoint}/").status_code, 200)
                self.assertEqual(self.client.post(f"/api/v1/{endpoint}/", {}, format="json").status_code, 403)
        for endpoint in ("monitoring/test-connection", "monitoring/bulk-action", "monitoring/scan-all"):
            self.assertEqual(self.client.post(f"/api/v1/{endpoint}/", {}, format="json").status_code, 403)
        target = MonitoringTarget.objects.create(organization=self.org, name="Existing", endpoint="https://example.com")
        for endpoint in ("monitoring", "monitoring-targets"):
            self.assertEqual(self.client.post(f"/api/v1/{endpoint}/{target.id}/scan/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/v1/monitoring/{target.id}/", {"enabled": True}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/v1/monitoring/{target.id}/").status_code, 200)

    def test_previously_queued_scans_cannot_run_for_expired_org(self):
        self.expire()
        resources = [
            (MonitoringTarget.objects.create(organization=self.org, name="Web", endpoint="https://example.com"), run_monitoring_check),
            (SSLCertificate.objects.create(organization=self.org, domain="example.com"), scan_ssl_certificate),
            (DNSRecord.objects.create(organization=self.org, domain="example.com", record_type="A"), scan_dns_records),
            (DomainInfo.objects.create(organization=self.org, domain="example.com"), scan_whois),
            (APICheckTarget.objects.create(organization=self.org, name="API", url="https://example.com"), run_api_check),
            (SecurityHeaderTarget.objects.create(organization=self.org, name="Headers", url="https://example.com"), scan_security_headers),
        ]
        with patch("socket.create_connection", side_effect=AssertionError("Unexpected network")), patch("requests.sessions.Session.request", side_effect=AssertionError("Unexpected HTTP")):
            for resource, task in resources:
                self.assertEqual(task.run(str(resource.id))["reason"], "subscription_required")
        self.assertEqual(register_target_in_submonitors.run(str(resources[0][0].id))["reason"], "subscription_required")

    def test_payment_must_be_verified_for_all_paid_tiers(self):
        self.expire()
        for tier in ("pro", "business", "enterprise"):
            with self.assertRaises(ValueError):
                OrganizationService.change_plan(self.org.id, tier)
        OrganizationService.change_plan(self.org.id, "free")
        self.org.refresh_from_db()
        self.assertFalse(monitoring_allowed(self.org))
        OrganizationService.change_plan(self.org.id, "pro", verified_payment=True)
        self.org.refresh_from_db()
        self.assertTrue(monitoring_allowed(self.org))

    def test_probe_keeps_heartbeat_but_stops_assignments_and_results(self):
        probe = AgentProbe.objects.create(organization=self.org, name="Branch", token_hash="a" * 64)
        self.expire()
        self.assertEqual(AgentProbeService.process_heartbeat(probe), [])
        probe.refresh_from_db()
        self.assertIsNotNone(probe.last_heartbeat)
        with self.assertRaises(SubscriptionRequired):
            AgentProbeService.ingest_results(probe, [])

    def test_unknown_or_suspended_subscription_fails_closed(self):
        self.org.trial_ends_at = None
        self.org.save()
        self.assertFalse(self.org.is_in_trial)
        self.assertFalse(monitoring_allowed(self.org))
        self.org.subscription_status = "active"
        self.org.status = "suspended"
        self.assertFalse(monitoring_allowed(self.org))

    def test_scheduler_excludes_expired_trial_before_beat_updates_status(self):
        MonitoringTarget.objects.create(organization=self.org, name="Web", endpoint="https://example.com")
        self.expire("trialing")
        with patch("monitoring.tasks.run_monitoring_check.delay") as enqueue:
            schedule_all_checks.run()
            enqueue.assert_not_called()
            self.org.subscription_status = "active"
            self.org.save()
            schedule_all_checks.run()
            enqueue.assert_called_once()

    def test_creation_forwards_opt_out_and_http_configuration(self):
        with patch("monitoring.tasks.register_target_in_submonitors.delay") as provision:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post("/api/v1/monitoring/", {
                    "name": "Configured API", "target_type": "api", "endpoint": "https://8.8.8.8/health",
                    "related_modules": [], "http_method": "POST", "expected_status": 201,
                    "custom_headers": {"X-Test": "fixture"}, "request_body": "{}", "max_latency_ms": 3000,
                }, format="json")
        self.assertEqual(response.status_code, 201)
        target = MonitoringTarget.objects.get(id=response.data["data"]["id"])
        provision.assert_called_once_with(str(target.id), [])
        self.assertEqual(target.http_method, "POST")
        self.assertEqual(target.expected_status, 201)
        self.assertEqual(target.custom_headers, {"X-Test": "fixture"})
        self.assertEqual(target.max_latency_ms, 3000)


class CoverageTests(TestCase):
    def test_scheduler_respects_free_floor_and_slower_resource_intervals(self):
        now = timezone.now()
        free = Organization.objects.create(name="Free timing", slug="free-timing")
        pro = Organization.objects.create(name="Pro timing", slug="pro-timing", plan_tier="pro")
        free_target = MonitoringTarget.objects.create(organization=free, name="Legacy fast", endpoint="https://example.com", interval=60, last_checked_at=now - timedelta(seconds=100))
        pro_target = MonitoringTarget.objects.create(organization=pro, name="Pro", endpoint="https://example.com", interval=60, last_checked_at=now - timedelta(seconds=100))
        MonitoringTarget.objects.create(organization=pro, name="Slow", endpoint="https://example.com", interval=600, last_checked_at=now - timedelta(seconds=100))
        with patch("monitoring.tasks.run_monitoring_check.delay") as enqueue:
            schedule_all_checks.run()
            enqueue.assert_called_once_with(str(pro_target.id), scan_token=ANY)
            enqueue.reset_mock()
            pro_target.last_checked_at = now
            pro_target.save()
            free_target.last_checked_at = now - timedelta(seconds=301)
            free_target.save()
            schedule_all_checks.run()
            enqueue.assert_called_once_with(str(free_target.id), scan_token=ANY)

    def test_api_scheduler_clamps_legacy_fast_free_resources(self):
        org = Organization.objects.create(name="API timing", slug="api-timing")
        target = APICheckTarget.objects.create(organization=org, name="API", url="https://example.com", check_interval=60, last_checked_at=timezone.now() - timedelta(seconds=100))
        with patch("api_checks.tasks.run_api_check.delay") as enqueue:
            run_all_api_checks.run()
            enqueue.assert_not_called()
            target.last_checked_at = timezone.now() - timedelta(seconds=301)
            target.save()
            run_all_api_checks.run()
            enqueue.assert_called_once_with(str(target.id), scan_token=ANY)

    def test_protocol_matrix(self):
        for protocol, expected in {"https": {"ssl", "dns", "security"}, "http": {"dns", "security"}, "tcp": set(), "dns": {"dns"}, "ssl": {"ssl"}, "api": set()}.items():
            with self.subTest(protocol=protocol):
                endpoint = f"{protocol}://example.com" if protocol in ("http", "https") else "example.com:443"
                self.assertEqual(coverage(protocol, endpoint)[0], expected)

    def test_opt_out_private_agents_and_ip_literals(self):
        self.assertEqual(coverage("https", "https://example.com", requested=[])[0], set())
        self.assertEqual(coverage("https", "https://internal.local", "agent")[0], set())
        self.assertEqual(coverage("https", "https://8.8.8.8")[0], {"ssl", "security"})
        self.assertEqual(coverage("http", "http://example.com", requested=["ssl", "api", "domain"])[0], {"domain"})
        self.assertEqual(coverage("tcp", "example.com:443", requested=["ssl", "dns", "domain"])[0], set())
        self.assertEqual(coverage("https", "https://example.com:8443/path")[2], 8443)

    def test_provisioning_is_idempotent_and_respects_quotas(self):
        org = Organization.objects.create(name="Coverage", slug="coverage", plan_tier="free")
        target = MonitoringTarget.objects.create(organization=org, name="Web", target_type="https", endpoint="https://example.com:8443/path")
        with patch("ssl_monitor.tasks.scan_ssl_certificate.delay"), patch("dns_monitor.tasks.scan_dns_records.delay"), patch("security_headers.tasks.scan_security_headers.delay"):
            first = register_target_in_submonitors.run(str(target.id))
            second = register_target_in_submonitors.run(str(target.id))
        self.assertEqual(set(first["created"]), {"ssl", "dns", "security"})
        self.assertEqual(set(second["existing"]), {"ssl", "dns", "security"})
        self.assertEqual(SSLCertificate.objects.get(organization=org).port, 8443)
        self.assertEqual(DomainInfo.objects.filter(organization=org).count(), 0)
        self.assertEqual(APICheckTarget.objects.filter(organization=org).count(), 0)
        SSLCertificate.objects.create(organization=org, domain="second.example.com")
        target.endpoint = "https://third.example.com"
        target.save()
        result = register_target_in_submonitors.run(str(target.id), ["ssl"])
        self.assertIn("ssl", result["failed"])
        self.assertEqual(SSLCertificate.objects.filter(organization=org).count(), 2)
