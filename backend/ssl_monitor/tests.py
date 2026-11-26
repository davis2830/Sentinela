from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from monitoring.models import MonitoringTarget, TargetCoverage
from organizations.models import Organization
from ssl_monitor.models import SSLCertificate
from ssl_monitor.serializers import SSLCertificateSerializer
from ssl_monitor.services import SSLMonitorService


class SSLCertificateSerializerAndOrderingTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="SSL Test Org", slug="ssl-test-org")

    def test_default_ordering_soonest_expiring_and_expired_first(self):
        now = timezone.now()
        SSLCertificate.objects.create(
            organization=self.org,
            domain="healthy.example.com",
            days_remaining=39,
            expiration_date=now + timedelta(days=39),
            last_scanned_at=now,
            is_valid=True,
        )
        SSLCertificate.objects.create(
            organization=self.org,
            domain="expiring.example.com",
            days_remaining=10,
            expiration_date=now + timedelta(days=10),
            last_scanned_at=now,
            is_valid=True,
        )
        SSLCertificate.objects.create(
            organization=self.org,
            domain="expired.example.com",
            days_remaining=-3,
            expiration_date=now - timedelta(days=3),
            last_scanned_at=now,
            is_valid=False,
        )
        SSLCertificate.objects.create(
            organization=self.org,
            domain="pending.example.com",
            days_remaining=None,
            last_scanned_at=None,
            is_valid=True,
        )

        ordered_domains = list(
            SSLMonitorService.list_certificates(self.org.id).values_list("domain", flat=True)
        )
        self.assertEqual(
            ordered_domains,
            [
                "expired.example.com",
                "expiring.example.com",
                "healthy.example.com",
                "pending.example.com",
            ],
        )

    def test_linked_and_suggested_targets_exposure(self):
        target = MonitoringTarget.objects.create(
            organization=self.org,
            name="gctorque web",
            target_type="https",
            endpoint="https://gctorque.com/health",
            runner_type="cloud",
        )
        cert = SSLCertificate.objects.create(
            organization=self.org,
            domain="gctorque.com",
            port=443,
            days_remaining=30,
            last_scanned_at=timezone.now(),
            is_valid=True,
        )

        # Before linking: suggested_targets finds matching Uptime target
        data_unlinked = SSLCertificateSerializer(cert, context={}).data
        self.assertEqual(data_unlinked["linked_targets"], [])
        self.assertEqual(len(data_unlinked["suggested_targets"]), 1)
        self.assertEqual(data_unlinked["suggested_targets"][0]["name"], "gctorque web")

        # After linking via TargetCoverage to an active target: linked_targets populated, suggested_targets empty
        TargetCoverage.objects.create(target=target, ssl=cert)
        data_linked = SSLCertificateSerializer(cert, context={}).data
        self.assertEqual(len(data_linked["linked_targets"]), 1)
        self.assertEqual(data_linked["linked_targets"][0]["id"], str(target.id))
        self.assertTrue(data_linked["linked_targets"][0]["enabled"])
        self.assertEqual(data_linked["suggested_targets"], [])

    def test_paused_linked_target_exposes_enabled_false_and_suggests_active_target(self):
        paused_target = MonitoringTarget.objects.create(
            organization=self.org,
            name="test",
            target_type="https",
            endpoint="https://gctorque.com/health",
            runner_type="cloud",
            enabled=False,
        )
        active_target = MonitoringTarget.objects.create(
            organization=self.org,
            name="gctorque web",
            target_type="https",
            endpoint="https://gctorque.com/",
            runner_type="cloud",
            enabled=True,
        )
        cert = SSLCertificate.objects.create(
            organization=self.org,
            domain="gctorque.com",
            port=443,
            days_remaining=30,
            last_scanned_at=timezone.now(),
            is_valid=True,
        )
        TargetCoverage.objects.create(target=paused_target, ssl=cert)

        data = SSLCertificateSerializer(cert, context={}).data
        self.assertEqual(data["linked_targets"][0]["name"], "test")
        self.assertFalse(data["linked_targets"][0]["enabled"])
        self.assertEqual(len(data["suggested_targets"]), 1)
        self.assertEqual(data["suggested_targets"][0]["id"], str(active_target.id))

    def test_issuance_history_tracks_fingerprint_changes_and_alert_summary(self):
        from alerts.models import AlertRule
        from notifications.models import NotificationChannel

        now = timezone.now()
        cert = SSLCertificate.objects.create(organization=self.org, domain="renew.example.com", port=443)
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="organizationName=Let's Encrypt, commonName=R11",
            subject="commonName=renew.example.com",
            expiration_date=now + timedelta(days=60),
            algorithm="SHA-256",
            key_info="ECDSA P-256",
            fingerprint="aa" * 32,
            days_remaining=60,
            is_valid=True,
            issued_at=now - timedelta(days=30),
            tls_version="TLSv1.3",
            security_grade="A+",
        )
        # Re-scanning with a new fingerprint records a second issuance entry
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="organizationName=Google Trust Services, commonName=WE1",
            subject="commonName=renew.example.com",
            expiration_date=now + timedelta(days=90),
            algorithm="SHA-256",
            key_info="RSA 2048",
            fingerprint="bb" * 32,
            days_remaining=90,
            is_valid=True,
            issued_at=now,
            tls_version="TLSv1.3",
            security_grade="A+",
        )
        cert.refresh_from_db()
        self.assertEqual(cert.key_info, "RSA 2048")
        self.assertEqual(len(cert.issuance_history), 2)
        self.assertEqual(cert.issuance_history[0]["fingerprint"], "bb" * 32)
        self.assertEqual(cert.issuance_history[1]["fingerprint"], "aa" * 32)

        AlertRule.objects.create(
            organization=self.org,
            name="SSL 14d",
            target_type=AlertRule.TargetType.SSL,
            condition=AlertRule.ConditionType.SSL_EXPIRING,
            threshold=14,
            severity=AlertRule.Severity.WARNING,
            enabled=True,
        )
        NotificationChannel.objects.create(
            organization=self.org,
            name="Alertas Ops",
            channel_type=NotificationChannel.ChannelType.EMAIL,
            enabled=True,
        )
        data = SSLCertificateSerializer(cert, context={}).data
        self.assertEqual(len(data["alert_summary"]["rules"]), 1)
        self.assertEqual(data["alert_summary"]["destinations"][0]["name"], "Alertas Ops")
