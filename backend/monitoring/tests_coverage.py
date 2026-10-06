from unittest.mock import patch

from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from monitoring.models import MonitoringTarget, TargetCoverage
from monitoring.coverage import identity, link_provisioned
from ssl_monitor.models import SSLCertificate
from dns_monitor.models import DNSRecord
from domain.models import DomainInfo
from security_headers.models import SecurityHeaderTarget
from audit.models import AuditLog
from alerts.models import Alert
from incidents.models import Incident, IncidentAlert


class CoverageTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Coverage", slug="coverage-tests", plan_tier="pro", subscription_status="active")
        self.other = Organization.objects.create(name="Other", slug="coverage-other", subscription_status="active")
        self.user = User.objects.create_user(email="coverage@example.test", password="test-pass", organization=self.org, is_staff=True)
        self.viewer = User.objects.create_user(email="coverage-viewer@example.test", password="test-pass", organization=self.org)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.target = MonitoringTarget.objects.create(organization=self.org, name="Portal", target_type="https", endpoint="https://www.example.com")
        self.ssl = SSLCertificate.objects.create(organization=self.org, domain="www.example.com", port=443)
        self.dns = DNSRecord.objects.create(organization=self.org, domain="www.example.com", record_type="A")
        self.domain = DomainInfo.objects.create(organization=self.org, domain="example.com")
        self.security = SecurityHeaderTarget.objects.create(organization=self.org, name="Headers", url="https://www.example.com/")
        self.url = f"/api/v1/monitoring/{self.target.pk}/coverage/"

    def select(self, **overrides):
        body = {"ssl": [str(self.ssl.pk)], "dns": [str(self.dns.pk)], "domain": [str(self.domain.pk)], "security": [str(self.security.pk)]}
        body.update(overrides)
        return self.client.patch(self.url, body, format="json")

    def test_get_suggests_only_and_has_no_writes_or_network(self):
        counts = [m.objects.count() for m in (TargetCoverage, SSLCertificate, DNSRecord, DomainInfo, AuditLog)]
        with patch("requests.sessions.Session.request") as outbound, patch("monitoring.tasks.run_monitoring_check.delay") as scan:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        for section in response.data["data"]["sections"].values():
            self.assertEqual(section["status"], "unlinked")
            self.assertEqual(section["resources"], [])
            self.assertEqual(len(section["candidates"]), 1)
        self.assertEqual(counts, [m.objects.count() for m in (TargetCoverage, SSLCertificate, DNSRecord, DomainInfo, AuditLog)])
        outbound.assert_not_called()
        scan.assert_not_called()

    def test_confirmed_links_persist_and_are_audited_without_scanning(self):
        with patch("monitoring.tasks.run_monitoring_check.delay") as scan:
            response = self.select()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(TargetCoverage.objects.get(target=self.target).domain_id, self.domain.pk)
        for section in self.client.get(self.url).data["data"]["sections"].values():
            self.assertEqual(section["status"], "linked")
            self.assertEqual(len(section["resources"]), 1)
        self.assertTrue(AuditLog.objects.filter(organization_id=self.org.pk, metadata__target_id=str(self.target.pk)).exists())
        scan.assert_not_called()

    def test_cross_tenant_target_and_selections_are_denied_atomically(self):
        foreign = SSLCertificate.objects.create(organization=self.other, domain="www.example.com")
        response = self.select(ssl=[str(foreign.pk)])
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TargetCoverage.objects.exists())
        outsider = MonitoringTarget.objects.create(organization=self.other, name="Private", target_type="https", endpoint=self.target.endpoint)
        self.assertEqual(self.client.get(f"/api/v1/monitoring/{outsider.pk}/coverage/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/v1/monitoring/{outsider.pk}/coverage/", {"ssl": []}, format="json").status_code, 404)

    def test_hostname_port_path_query_and_domain_boundary_are_exact(self):
        bad_ssl = SSLCertificate.objects.create(organization=self.org, domain="example.com", port=443)
        bad_dns = DNSRecord.objects.create(organization=self.org, domain="example.com", record_type="A")
        bad_sec = SecurityHeaderTarget.objects.create(organization=self.org, name="Other path", url="https://www.example.com/admin")
        bad_domain = DomainInfo.objects.create(organization=self.org, domain="ample.com")
        for module, resource in [("ssl", bad_ssl), ("dns", bad_dns), ("security", bad_sec), ("domain", bad_domain)]:
            self.assertEqual(self.client.patch(self.url, {module: [str(resource.pk)]}, format="json").status_code, 400)
        self.ssl.port = 8443
        self.ssl.save()
        self.assertEqual(self.select().status_code, 400)
        self.assertEqual(identity("HTTPS://WWW.EXAMPLE.COM:443/#section")[2], "https://www.example.com/")
        self.assertNotEqual(identity("https://www.example.com/A?q=1")[2], identity("https://www.example.com/a?q=2")[2])

    def test_whois_configured_multilabel_ancestor_requires_confirmation(self):
        self.target.endpoint = "https://portal.example.co.uk"
        self.target.save()
        root = DomainInfo.objects.create(organization=self.org, domain="example.co.uk")
        section = self.client.get(self.url).data["data"]["sections"]["domain"]
        self.assertEqual(section["resources"], [])
        self.assertEqual(section["candidates"], [{"id": str(root.pk), "label": "example.co.uk"}])
        self.assertEqual(self.client.patch(self.url, {"domain": [str(root.pk)]}, format="json").status_code, 200)

    def test_changed_endpoint_or_corrupt_foreign_link_is_never_presented(self):
        self.select()
        self.target.endpoint = "https://other.example.com"
        self.target.save()
        sections = self.client.get(self.url).data["data"]["sections"]
        for module in ("ssl", "dns", "security"):
            self.assertEqual(sections[module]["status"], "needs_review")
            self.assertEqual(sections[module]["resources"], [])
        foreign = DomainInfo.objects.create(organization=self.other, domain="example.com", registrar="SECRET OTHER TENANT")
        TargetCoverage.objects.filter(target=self.target).update(domain=foreign)
        response = self.client.get(self.url)
        self.assertNotIn("SECRET OTHER TENANT", str(response.data))

    def test_http_tcp_agent_and_ip_have_only_applicable_coverage(self):
        for kind, endpoint, runner, expected in [
            ("http", "http://www.example.com", "cloud", {"ssl"}),
            ("tcp", "www.example.com:443", "cloud", {"ssl", "dns", "domain", "security"}),
            ("https", "https://www.example.com", "agent", {"ssl", "dns", "domain", "security"}),
            ("https", "https://203.0.113.8", "cloud", {"dns", "domain"}),
        ]:
            self.target.target_type, self.target.endpoint, self.target.runner_type = kind, endpoint, runner
            self.target.save()
            sections = self.client.get(self.url).data["data"]["sections"]
            self.assertEqual({key for key, value in sections.items() if value["status"] == "not_applicable"}, expected)

    def test_viewer_and_expired_org_keep_reads_but_cannot_link(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.select().status_code, 403)
        self.client.force_authenticate(self.user)
        self.org.subscription_status = "past_due"
        self.org.save()
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.select().status_code, 403)

    def test_invalid_selection_and_unlink_do_not_delete_resources(self):
        for body in [{"dns": ["bad-uuid"]}, {"ssl": [str(self.ssl.pk)] * 2}, {"unknown": []}, {"dns": "not-list"}]:
            self.assertEqual(self.client.patch(self.url, body, format="json").status_code, 400)
        self.select()
        self.assertEqual(self.client.patch(self.url, {"ssl": [], "dns": []}, format="json").status_code, 200)
        self.assertTrue(SSLCertificate.objects.filter(pk=self.ssl.pk).exists())
        self.assertTrue(DNSRecord.objects.filter(pk=self.dns.pk).exists())
        self.ssl.delete()
        self.assertTrue(MonitoringTarget.objects.filter(pk=self.target.pk).exists())

    def test_provisioning_records_resource_but_never_guesses_whois(self):
        link_provisioned(self.target, "ssl", self.ssl)
        link_provisioned(self.target, "dns", self.dns)
        link_provisioned(self.target, "domain", self.domain)
        links = TargetCoverage.objects.get(target=self.target)
        self.assertEqual(links.ssl_id, self.ssl.pk)
        self.assertIsNone(links.domain_id)
        self.assertEqual(links.dns.count(), 1)

    def test_activity_only_contains_linked_resources_and_own_incidents(self):
        self.select()
        alert = Alert.objects.create(organization=self.org, title="Certificate expired", message="SSL", target_type="ssl", target_id=self.ssl.pk, severity="critical")
        Alert.objects.create(organization=self.other, title="Foreign secret", message="secret", target_type="ssl", target_id=self.ssl.pk)
        Alert.objects.create(organization=self.org, title="Unrelated", message="Other", target_type="monitoring", target_id=self.security.pk)
        incident = Incident.objects.create(organization=self.org, title="Own outage")
        IncidentAlert.objects.create(incident=incident, alert_id=alert.pk)
        activity = self.client.get(self.url).data["data"]["activity"]
        self.assertEqual([a["title"] for a in activity["alerts"]], ["Certificate expired"])
        self.assertEqual([i["title"] for i in activity["incidents"]], ["Own outage"])

    def test_linked_dns_query_count_does_not_grow_per_resource(self):
        self.select()
        with CaptureQueriesContext(connection) as single:
            self.assertEqual(self.client.get(self.url).status_code, 200)
        links = TargetCoverage.objects.get(target=self.target)
        for kind in ("AAAA", "CNAME", "MX", "TXT"):
            links.dns.add(DNSRecord.objects.create(organization=self.org, domain="www.example.com", record_type=kind))
        with CaptureQueriesContext(connection) as multiple:
            response = self.client.get(self.url)
        self.assertEqual(len(response.data["data"]["sections"]["dns"]["resources"]), 5)
        self.assertEqual(len(single), len(multiple))
