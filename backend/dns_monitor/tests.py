from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from alerts.evaluators import MetricEvaluators
from alerts.models import AlertRule
from dns_monitor.models import DNSChangeHistory, DNSRecord
from dns_monitor.serializers import DNSRecordSerializer
from dns_monitor.services import DNSMonitorService
from monitoring.models import MonitoringTarget, TargetCoverage
from organizations.models import Organization


class DNSMonitorServicesTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="DNS Test Org",
            slug="dns-test-org",
            plan_tier="pro",
            subscription_status="active",
        )
        self.user = User.objects.create_user(
            email="dns-admin@example.com",
            password="test-password-123!",
            organization=self.org,
            is_staff=True,
        )
        self.record = DNSRecord.objects.create(
            organization=self.org,
            domain="servixcloud.com",
            record_type="A",
            value="104.21.91.196\n172.67.197.121",
            ttl=60,
            resolver="1.1.1.1",
            last_attempt_status="success",
            last_scanned_at=timezone.now(),
            last_successful_at=timezone.now(),
        )

    def test_round_robin_reordering_does_not_create_false_mutation(self):
        """Reordering identical IPs (CDN / round-robin) must NOT record a mutation."""
        updated = DNSMonitorService.update_record_scan(
            self.record.id,
            new_value="172.67.197.121\n104.21.91.196",
            ttl=60,
            response_time_ms=11.4,
            resolver="1.1.1.1",
            resolver_results=[
                {"resolver": "1.1.1.1", "label": "Cloudflare", "success": True, "values": ["104.21.91.196", "172.67.197.121"], "ttl": 60, "latency_ms": 11},
                {"resolver": "8.8.8.8", "label": "Google", "success": True, "values": ["104.21.91.196", "172.67.197.121"], "ttl": 60, "latency_ms": 14},
            ],
            propagation_status="consistent",
        )
        self.assertEqual(DNSChangeHistory.objects.filter(record=updated).count(), 0)
        self.assertIsNone(updated.last_change_at)
        self.assertEqual(updated.propagation_status, "consistent")
        self.assertEqual(len(updated.resolver_results), 2)

    def test_real_ip_change_records_mutation_and_latest_change(self):
        updated = DNSMonitorService.update_record_scan(
            self.record.id,
            new_value="104.21.91.196\n172.67.197.200",
            ttl=60,
            response_time_ms=13.2,
            resolver="1.1.1.1",
            propagation_status="consistent",
        )
        self.assertIsNotNone(updated.last_change_at)
        self.assertEqual(DNSChangeHistory.objects.filter(record=updated).count(), 1)

        data = DNSRecordSerializer(updated).data
        self.assertIsNotNone(data["latest_change"])
        self.assertIn("172.67.197.121", data["latest_change"]["old_value"])
        self.assertIn("172.67.197.200", data["latest_change"]["new_value"])

    def test_accept_current_as_reference_adopts_values_and_silences_alert(self):
        self.record.expected_values = ["1.2.3.4"]
        self.record.matches_expected = False
        # Set last_change_at older than TTL so it is outside propagation window
        self.record.last_change_at = timezone.now() - timezone.timedelta(hours=1)
        self.record.save()

        rule = AlertRule.objects.create(
            organization=self.org,
            name="DNS Drift",
            target_type="dns",
            condition="dns_changed",
            severity="warning",
            enabled=True,
        )
        # Before accepting reference: persistent mismatch triggers alert
        self.assertTrue(MetricEvaluators._check_dns_changed(rule))

        accepted = DNSMonitorService.accept_current_as_reference(self.record.id, self.org.id)
        self.assertEqual(accepted.expected_values, ["104.21.91.196", "172.67.197.121"])
        self.assertTrue(accepted.matches_expected)
        self.assertIsNotNone(accepted.reference_updated_at)

        # After accepting reference: matches expected -> no alert
        self.assertFalse(MetricEvaluators._check_dns_changed(rule))

    def test_ttl_propagation_window_prevents_premature_mismatch_alert(self):
        self.record.expected_values = ["1.2.3.4"]
        self.record.matches_expected = False
        self.record.ttl = 300
        # Changed 30 seconds ago (< 300s TTL) -> still propagating, should NOT alert yet
        self.record.last_change_at = timezone.now() - timezone.timedelta(seconds=30)
        self.record.save()

        rule = AlertRule.objects.create(
            organization=self.org,
            name="DNS Drift TTL",
            target_type="dns",
            condition="dns_changed",
            severity="warning",
            enabled=True,
        )
        self.assertFalse(MetricEvaluators._check_dns_changed(rule))

    def test_provider_and_cidr_reference_modes_handle_rotating_ips(self):
        rotating = DNSRecord.objects.create(
            organization=self.org,
            domain="gctorque.com",
            record_type="A",
            value="216.198.79.1\n64.29.17.1",
            expected_values=["216.198.79.65", "64.29.17.65"],
            reference_mode="provider",
            ttl=300,
        )
        # Provider /24 mode matches rotating IPs within the same /24 prefixes
        updated = DNSMonitorService.update_record_scan(
            rotating.id,
            new_value="216.198.79.1\n64.29.17.1",
            ttl=300,
            response_time_ms=42.0,
            resolver="1.1.1.1",
            propagation_status="consistent",
        )
        self.assertTrue(updated.matches_expected)

        # Accept as CIDR mode generates deduplicated /24 ranges
        cidr_accepted = DNSMonitorService.accept_current_as_reference(
            rotating.id,
            self.org.id,
            reference_mode="cidr",
        )
        self.assertEqual(cidr_accepted.reference_mode, "cidr")
        self.assertEqual(cidr_accepted.expected_values, ["216.198.79.0/24", "64.29.17.0/24"])
        self.assertTrue(cidr_accepted.matches_expected)

        # Even if 1.1.1.1 and 8.8.8.8 return different edge IPs in the same /24 ranges,
        # CIDR reference treats them as consistent rather than perpetual propagation.
        consistent_cidr = DNSMonitorService.update_record_scan(
            rotating.id,
            new_value="216.198.79.1\n64.29.17.1",
            ttl=300,
            response_time_ms=42.0,
            resolver="1.1.1.1",
            resolver_results=[
                {"resolver": "1.1.1.1", "label": "Cloudflare", "success": True, "values": ["216.198.79.1", "64.29.17.1"]},
                {"resolver": "8.8.8.8", "label": "Google", "success": True, "values": ["216.198.79.65", "64.29.17.65"]},
            ],
            propagation_status="propagating",
        )
        self.assertEqual(consistent_cidr.propagation_status, "consistent")
        self.assertTrue(consistent_cidr.matches_expected)

        # An IP outside both /24 ranges must fail CIDR match
        drifted = DNSMonitorService.update_record_scan(
            rotating.id,
            new_value="198.51.100.10",
            ttl=300,
            response_time_ms=40.0,
            resolver="1.1.1.1",
            propagation_status="consistent",
        )
        self.assertFalse(drifted.matches_expected)

    def test_accept_reference_api_endpoint(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.post(f"/api/v1/dns-records/{self.record.id}/accept-reference/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()["data"]
        self.assertTrue(payload["matches_expected"])
        self.assertEqual(payload["expected_values"], ["104.21.91.196", "172.67.197.121"])

    def test_resolve_dns_query_detects_propagation_divergence(self):
        fake_results = [
            {
                "resolver": "1.1.1.1",
                "label": "Cloudflare",
                "success": True,
                "values": ["216.198.79.65"],
                "ttl": 300,
                "latency_ms": 12.0,
                "error_type": None,
                "error_message": None,
            },
            {
                "resolver": "8.8.8.8",
                "label": "Google",
                "success": True,
                "values": ["216.198.79.64"],
                "ttl": 300,
                "latency_ms": 18.0,
                "error_type": None,
                "error_message": None,
            },
        ]
        with patch.object(DNSMonitorService, "_query_single_resolver", side_effect=fake_results):
            result = DNSMonitorService.resolve_dns_query("gctorque.com", "A")
        self.assertTrue(result["success"])
        self.assertEqual(result["resolver"], "1.1.1.1")
        self.assertEqual(result["propagation_status"], "propagating")
        self.assertEqual(len(result["resolver_results"]), 2)

    def test_linked_and_suggested_targets_prioritize_active_targets(self):
        paused_target = MonitoringTarget.objects.create(
            organization=self.org,
            name="servix paused",
            target_type="https",
            endpoint="https://servixcloud.com",
            enabled=False,
        )
        active_target = MonitoringTarget.objects.create(
            organization=self.org,
            name="servixcloud",
            target_type="https",
            endpoint="https://servixcloud.com",
            enabled=True,
        )
        cov = TargetCoverage.objects.create(target=paused_target)
        cov.dns.add(self.record)

        data = DNSRecordSerializer(self.record).data
        self.assertEqual(len(data["linked_targets"]), 1)
        self.assertFalse(data["linked_targets"][0]["enabled"])
        self.assertEqual(len(data["suggested_targets"]), 1)
        self.assertEqual(data["suggested_targets"][0]["id"], str(active_target.id))
