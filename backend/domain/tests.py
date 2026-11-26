from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from dns_monitor.models import DNSRecord
from domain.models import DomainChangeHistory, DomainInfo
from domain.serializers import DomainInfoSerializer
from domain.services import DomainService
from monitoring.models import MonitoringTarget, TargetCoverage
from organizations.models import Organization
from ssl_monitor.models import SSLCertificate


class DomainModuleTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Domain Test Org",
            slug="domain-test-org",
            plan_tier="pro",
            subscription_status="active",
        )
        self.user = User.objects.create_user(
            email="domain-admin@example.com",
            password="test-password-123!",
            organization=self.org,
            is_staff=True,
        )
        self.domain = DomainInfo.objects.create(
            organization=self.org,
            domain="gctorque.com",
            registrar="Cloudflare, Inc.",
            creation_date=timezone.now() - timedelta(days=205),
            expiration_date=timezone.now() + timedelta(days=160),
            days_until_expiration=160,
            is_locked=True,
            name_servers="ns1.cloudflare.com\nns2.cloudflare.com",
            status="clientTransferProhibited",
            data_source="rdap",
            last_scanned_at=timezone.now(),
            last_successful_at=timezone.now(),
        )

    def test_ns_order_change_does_not_create_false_change_history(self):
        updated = DomainService.update_domain_scan(
            domain_id=self.domain.id,
            registrar="Cloudflare, Inc.",
            creation_date=self.domain.creation_date,
            expiration_date=self.domain.expiration_date,
            last_updated=timezone.now(),
            status="clientTransferProhibited",
            name_servers="ns2.cloudflare.com\nns1.cloudflare.com",
            registrant_country="",
            days_until_expiration=160,
            is_locked=True,
            data_source="rdap",
        )
        self.assertEqual(DomainChangeHistory.objects.filter(domain_info=updated).count(), 0)
        self.assertIsNone(updated.last_change_at)

    def test_nameserver_and_lock_changes_record_history_and_acknowledge(self):
        updated = DomainService.update_domain_scan(
            domain_id=self.domain.id,
            registrar="Cloudflare, Inc.",
            creation_date=self.domain.creation_date,
            expiration_date=self.domain.expiration_date,
            last_updated=timezone.now(),
            status="ok",
            name_servers="ns1.attacker.net\nns2.attacker.net",
            registrant_country="",
            days_until_expiration=160,
            is_locked=False,
            data_source="rdap",
        )
        self.assertIsNotNone(updated.last_change_at)
        changes = list(DomainChangeHistory.objects.filter(domain_info=updated).values_list("field_name", flat=True))
        self.assertEqual(len(changes), 3)
        self.assertIn("name_servers", changes)
        self.assertIn("is_locked", changes)
        self.assertIn("status", changes)

        data = DomainInfoSerializer(updated).data
        self.assertTrue(data["has_unacknowledged_changes"])

        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.post(f"/api/v1/domains/{updated.id}/acknowledge-changes/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["data"]["has_unacknowledged_changes"])

    def test_auto_renew_patch_and_ns_health_serialization(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        resp = client.patch(f"/api/v1/domains/{self.domain.id}/", {"auto_renew": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIs(resp.json()["data"]["auto_renew"], True)

        resp = client.patch(f"/api/v1/domains/{self.domain.id}/", {"auto_renew": False}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIs(resp.json()["data"]["auto_renew"], False)

        ns_health_sample = {
            "total_count": 2,
            "responding_count": 2,
            "soa_consistent": True,
            "soa_serials": [2026112501],
            "zone_ns": ["ns1.cloudflare.com", "ns2.cloudflare.com"],
            "delegation_consistent": True,
            "servers": [
                {
                    "host": "ns1.cloudflare.com",
                    "ip": "108.162.193.1",
                    "responding": True,
                    "authoritative": True,
                    "soa_serial": 2026112501,
                    "latency_ms": 14.2,
                    "error": "",
                }
            ],
        }
        updated = DomainService.update_domain_scan(
            domain_id=self.domain.id,
            registrar="Cloudflare, Inc.",
            creation_date=self.domain.creation_date,
            expiration_date=self.domain.expiration_date,
            last_updated=timezone.now(),
            status="clientTransferProhibited",
            name_servers="ns1.cloudflare.com\nns2.cloudflare.com",
            registrant_country="",
            days_until_expiration=160,
            is_locked=True,
            data_source="rdap",
            ns_health=ns_health_sample,
        )
        data = DomainInfoSerializer(updated).data
        self.assertEqual(data["ns_health"]["responding_count"], 2)
        self.assertIs(data["ns_health"]["soa_consistent"], True)
        self.assertIs(data["ns_health"]["delegation_consistent"], True)

    def test_effective_thresholds_derived_from_active_domain_alert_rules(self):
        from alerts.models import AlertRule

        AlertRule.objects.create(
            organization=self.org,
            name="Dominio <= 60 d",
            target_type=AlertRule.TargetType.DOMAIN,
            condition=AlertRule.ConditionType.DOMAIN_EXPIRING,
            severity=AlertRule.Severity.WARNING,
            threshold=60,
            enabled=True,
        )
        AlertRule.objects.create(
            organization=self.org,
            name="Dominio <= 30 d",
            target_type=AlertRule.TargetType.DOMAIN,
            condition=AlertRule.ConditionType.DOMAIN_EXPIRING,
            severity=AlertRule.Severity.WARNING,
            threshold=30,
            enabled=True,
        )
        AlertRule.objects.create(
            organization=self.org,
            name="Dominio <= 14 d",
            target_type=AlertRule.TargetType.DOMAIN,
            condition=AlertRule.ConditionType.DOMAIN_EXPIRING,
            severity=AlertRule.Severity.CRITICAL,
            threshold=14,
            enabled=True,
        )
        AlertRule.objects.create(
            organization=self.org,
            name="Dominio <= 7 d",
            target_type=AlertRule.TargetType.DOMAIN,
            condition=AlertRule.ConditionType.DOMAIN_EXPIRING,
            severity=AlertRule.Severity.CRITICAL,
            threshold=7,
            enabled=True,
        )

        data = DomainInfoSerializer(self.domain).data
        eff = data["alert_summary"]["effective_thresholds"]
        self.assertEqual(eff["warning_days"], 60)
        self.assertEqual(eff["critical_days"], 14)
        self.assertEqual(eff["steps"], [60, 30, 14, 7])
        self.assertEqual(eff["source"], "rules")

    def test_manual_expiration_fallback_for_unsupported_tld(self):
        gt_domain = DomainInfo.objects.create(
            organization=self.org,
            domain="empresa.com.gt",
            error_message="WHOIS error: no RDAP for .gt",
            last_scanned_at=timezone.now(),
        )
        target_date = timezone.now().date() + timedelta(days=45)
        updated = DomainService.update_domain_record(
            gt_domain.id,
            self.org.id,
            manual_expiration_date=target_date.isoformat(),
            trigger_scan=False,
        )
        self.assertEqual(updated.manual_expiration_date, target_date)
        data = DomainInfoSerializer(updated).data
        self.assertEqual(data["effective_days_until_expiration"], 45)
        self.assertTrue(data["effective_expiration_date"].startswith(target_date.isoformat()))

    def test_dependencies_and_unwatched_domain_suggestions(self):
        t1 = MonitoringTarget.objects.create(
            organization=self.org,
            name="gctorque web",
            target_type="https",
            endpoint="https://gctorque.com",
            enabled=True,
        )
        MonitoringTarget.objects.create(
            organization=self.org,
            name="servixcloud",
            target_type="https",
            endpoint="https://servixcloud.gctechops.com",
            enabled=True,
        )
        DNSRecord.objects.create(organization=self.org, domain="gctorque.com", record_type="A")
        DNSRecord.objects.create(organization=self.org, domain="servixcloud.gctechops.com", record_type="A")
        SSLCertificate.objects.create(organization=self.org, domain="gctorque.com", port=443)
        SSLCertificate.objects.create(organization=self.org, domain="servixcloud.gctechops.com", port=443)

        cov = TargetCoverage.objects.create(target=t1, domain=self.domain)
        cov.save()

        data = DomainInfoSerializer(self.domain).data
        self.assertEqual(data["dependencies"]["targets_count"], 1)
        self.assertEqual(data["dependencies"]["dns_count"], 1)
        self.assertEqual(data["dependencies"]["ssl_count"], 1)
        self.assertEqual(len(data["linked_targets"]), 1)

        suggestions = DomainService.get_unwatched_domains(self.org.id)
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["domain"], "gctechops.com")
        self.assertEqual(suggestions[0]["targets_count"], 1)
        self.assertEqual(suggestions[0]["dns_count"], 1)
        self.assertEqual(suggestions[0]["ssl_count"], 1)
