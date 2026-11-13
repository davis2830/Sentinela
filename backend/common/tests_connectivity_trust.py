"""C01–C14 regressions using disposable tenant data and bounded transport doubles."""

import os
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch
from django.db import transaction, connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from accounts.models import User
from organizations.models import Organization
from api_checks.models import APICheckTarget
from api_checks.schema import validate_contract, differences
from dns_monitor.models import DNSRecord, DNSChangeHistory
from dns_monitor.services import DNSMonitorService
from monitoring.models import MonitoringTarget, AgentProbe, AgentExecution
from monitoring.services import AgentProbeService
from common.models import ScanExecution
from common.scan_limits import enqueue_scan


class ConnectivityTrustTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Trust", slug="connectivity-trust", beta_managed=False, plan_tier="enterprise"
        )
        self.admin = User.objects.create_user(
            "trust@example.test", organization=self.org, is_staff=True, email_verified_at=timezone.now()
        )
        self.viewer = User.objects.create_user(
            "trust-viewer@example.test", organization=self.org, email_verified_at=timezone.now()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_schema_types_missing_non_json_and_safe_differences(self):
        for expected in ["unknown", {}, None, 1, ["integer"]]:
            with self.subTest(expected=expected), self.assertRaises(ValidationError):
                validate_contract({"id": expected})
        self.assertTrue(differences(None, {"id": "integer"}))
        self.assertTrue(differences({"id": True}, {"id": "integer"}))
        self.assertTrue(differences({"id": False}, {"id": "float"}))
        self.assertFalse(
            differences(
                {"s": "ok", "i": 1, "f": 1.2, "b": True, "a": [], "o": {}},
                {"s": "string", "i": "integer", "f": "float", "b": "boolean", "a": "list", "o": "dict"},
            )
        )
        self.assertNotIn("private-value", str(differences({"id": "private-value"}, {"id": "int"})))

    def test_html_cannot_pass_a_required_schema(self):
        from api_checks.tasks import run_api_check

        target = APICheckTarget.objects.create(
            organization=self.org, name="HTML", url="https://example.test", expected_schema={"id": "int"}
        )
        response = Mock(status_code=200, headers={"Content-Type": "text/html", "Set-Cookie": "private-fixture"})
        response.json.side_effect = ValueError()
        with patch("api_checks.tasks.safe_http.request", return_value=response):
            run_api_check.run(str(target.pk))
        result = target.results.get()
        self.assertEqual(result.status, "fail")
        self.assertFalse(result.schema_valid)
        self.assertTrue(result.schema_failures)
        self.assertNotIn("private-fixture", str(result.response_headers))

    def test_dns_failures_keep_last_response_and_recovery_does_not_invent_change(self):
        record = DNSRecord.objects.create(
            organization=self.org, domain="example.test", record_type="A", expected_values=["1.1.1.1"]
        )
        DNSMonitorService.update_record_scan(record.pk, "1.1.1.1", 120, 12, resolver="9.9.9.9")
        valid = DNSRecord.objects.get(pk=record.pk).last_successful_at
        for code in ["TIMEOUT", "NXDOMAIN", "NO_ANSWER"]:
            DNSMonitorService.update_record_scan(
                record.pk, "", None, 500, error_code=code, error_message="Consulta fallida"
            )
            record.refresh_from_db()
            self.assertEqual(record.value, "1.1.1.1")
            self.assertEqual(record.last_successful_at, valid)
            self.assertIsNone(record.matches_expected)
        self.assertEqual(DNSChangeHistory.objects.count(), 0)
        DNSMonitorService.update_record_scan(record.pk, "1.1.1.1", 120, 12)
        self.assertEqual(DNSChangeHistory.objects.count(), 0)
        DNSMonitorService.update_record_scan(record.pk, "2.2.2.2", 120, 12)
        self.assertEqual(DNSChangeHistory.objects.count(), 1)
        record.refresh_from_db()
        self.assertFalse(record.matches_expected)

    def test_dns_reordering_is_not_change_and_all_types_agree(self):
        from dns_monitor.serializers import DNSRecordCreateSerializer

        record = DNSRecord.objects.create(
            organization=self.org, domain="example.test", record_type="A", value="1.1.1.1\n2.2.2.2"
        )
        DNSMonitorService.update_record_scan(record.pk, "2.2.2.2\n1.1.1.1", 60)
        self.assertEqual(DNSChangeHistory.objects.count(), 0)
        for kind in ["PTR", "SRV", "CAA", "SOA", "TXT"]:
            self.assertTrue(DNSRecordCreateSerializer(data={"domain": "example.test", "record_type": kind}).is_valid())

    def test_broker_failure_is_a_persistent_failure_without_mutation_retries(self):
        target = MonitoringTarget.objects.create(organization=self.org, name="Broker", endpoint="https://example.test")
        task = Mock()
        task.delay.side_effect = OSError("private-internal")
        with self.assertRaises(OSError):
            enqueue_scan(target, task)
        receipt = ScanExecution.objects.get()
        self.assertEqual(receipt.state, "failed")
        self.assertEqual(receipt.error_code, "BROKER_UNAVAILABLE")
        response = self.client.get(f"/api/v1/scan-executions/{receipt.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("private-internal", str(response.data))
        self.assertEqual(task.delay.call_count, 1)

    def test_initial_enqueue_is_after_commit_and_not_after_rollback(self):
        from common.executions import initial_scan

        target = MonitoringTarget.objects.create(organization=self.org, name="Commit", endpoint="https://example.test")
        task = Mock()
        task.delay.return_value = SimpleNamespace(id="fixture")
        with self.captureOnCommitCallbacks(execute=True):
            initial_scan(target, task)
            task.delay.assert_not_called()
        task.delay.assert_called_once()
        task.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    initial_scan(target, task)
                    raise RuntimeError()
            except RuntimeError:
                pass
        task.delay.assert_not_called()

    def test_bulk_ambiguous_failure_is_not_retried_and_reports_per_resource(self):
        from common.bulk import operate

        target = MonitoringTarget.objects.create(organization=self.org, name="Bulk", endpoint="https://example.test")
        with patch("common.bulk.enqueue_scan", side_effect=OSError("broker")) as enqueue:
            result = operate(MonitoringTarget, self.org.pk, "scan", [str(target.pk)], Mock())
        self.assertEqual(enqueue.call_count, 1)
        self.assertEqual(result["counts"]["unknown"], 1)
        self.assertEqual(result["results"][0]["id"], str(target.pk))

    def test_pagination_export_filter_and_bounded_queries(self):
        MonitoringTarget.objects.bulk_create(
            [
                MonitoringTarget(organization=self.org, name=f"Client {i:04}", endpoint="https://example.test")
                for i in range(100)
            ]
        )

        def read():
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get("/api/v1/monitoring/?page=2&search=Client")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data["data"]), 25)
            return len(queries)

        read()
        small = read()
        MonitoringTarget.objects.bulk_create(
            [
                MonitoringTarget(organization=self.org, name=f"Client extra {i:04}", endpoint="https://example.test")
                for i in range(900)
            ]
        )
        self.assertLessEqual(read(), small + 2)
        response = self.client.get("/api/v1/monitoring/?page=1")
        self.assertEqual(response.data["meta"]["total"], 1000)
        exported = self.client.get("/api/v1/monitoring/?page=2&export=csv&search=Client")
        self.assertEqual(len(exported.content.decode().splitlines()), 1001)

    def test_revoke_pauses_targets_preserves_history_and_revokes_authentication(self):
        raw, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Retire", token_hash=hashed)
        target = MonitoringTarget.objects.create(
            organization=self.org, name="Private", runner_type="agent", agent_probe=probe, endpoint="10.0.0.1:80"
        )
        ledger = AgentExecution.objects.create(
            organization=self.org, probe=probe, target=target, expires_at=timezone.now() + timedelta(minutes=5)
        )
        self.assertEqual(
            self.client.post(f"/api/v1/agent-probes/{probe.pk}/revoke/", {}, format="json").status_code, 400
        )
        response = self.client.post(
            f"/api/v1/agent-probes/{probe.pk}/revoke/", {"reason": "Equipo retirado"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertFalse(target.enabled)
        self.assertEqual(target.agent_probe_id, probe.pk)
        self.assertTrue(AgentExecution.objects.filter(pk=ledger.pk).exists())
        self.assertIsNone(AgentProbeService.authenticate_token(raw))
        self.assertEqual(self.client.get("/api/v1/agent-probes/?page=1").data["meta"]["total"], 0)
        self.assertEqual(self.client.get("/api/v1/agent-probes/?page=1&lifecycle=revoked").data["meta"]["total"], 1)

    def test_readers_cannot_create_install_rotate_or_revoke(self):
        raw, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Protected", token_hash=hashed)
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get(f"/api/v1/agent-probes/{probe.pk}/detail/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/agent-probes/{probe.pk}/installation/").status_code, 403)
        for url in ["agent-probes/", f"agent-probes/{probe.pk}/rotate-token/", f"agent-probes/{probe.pk}/revoke/"]:
            self.assertEqual(self.client.post("/api/v1/" + url, {}, format="json").status_code, 403)
        self.assertIsNotNone(AgentProbeService.authenticate_token(raw))

    def test_install_profile_no_secret_host_inference_or_shared_volume(self):
        from monitoring.probe_installation import profile

        a = AgentProbe(pk="11111111-1111-1111-1111-111111111111")
        b = AgentProbe(pk="22222222-2222-2222-2222-222222222222")
        with patch.dict(os.environ, {"SENTI9_CONTROL_URL": ""}):
            self.assertFalse(profile(a)["configured"])
            self.assertEqual(profile(a)["command"], "")
        with patch.dict(os.environ, {"SENTI9_CONTROL_URL": "https://control.example.test"}):
            for platform in ["linux", "windows"]:
                p = profile(a, platform)
                self.assertTrue(p["configured"])
                self.assertNotIn("gc_ops", p["command"])
                self.assertIn("readonly", p["command"])
                self.assertNotEqual(p["volume_name"], profile(b)["volume_name"])
        with patch.dict(os.environ, {"SENTI9_CONTROL_URL": "https://example.test/$(bad)"}):
            self.assertFalse(profile(a)["configured"])

    def test_diagnostic_neither_heartbeats_nor_dispatches(self):
        raw, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Diagnostic", token_hash=hashed)
        response = APIClient().get("/api/v1/agent-probes/diagnostic/", HTTP_X_PROBE_TOKEN=raw)
        self.assertEqual(response.status_code, 200)
        probe.refresh_from_db()
        self.assertIsNone(probe.last_heartbeat)
        self.assertEqual(AgentExecution.objects.count(), 0)
        self.assertNotIn(raw, str(response.data))

    def test_configuration_change_before_dispatch_does_not_measure_new_config_implicitly(self):
        from monitoring.tasks import run_monitoring_check
        from common.scan_limits import enqueue_scan

        target = MonitoringTarget.objects.create(
            organization=self.org, name="Changed", endpoint="https://old.example.test"
        )
        task = Mock()
        task.delay.return_value = SimpleNamespace(id="configuration-fixture")
        admitted = enqueue_scan(target, task)
        MonitoringTarget.objects.filter(pk=target.pk).update(endpoint="https://new.example.test")
        with patch("monitoring.tasks.safe_http.request") as transport:
            result = run_monitoring_check.run(str(target.pk), scan_token=admitted.execution_id)
        self.assertEqual(result["reason"], "configuration_changed")
        transport.assert_not_called()
        self.assertEqual(ScanExecution.objects.get(pk=admitted.execution_id).error_code, "CONFIGURATION_CHANGED")

    def test_invalid_csp_does_not_get_full_points(self):
        from security_headers.services import SecurityHeadersService

        for value in [
            "not a policy",
            "default-src",
            "arbitrary nonsense",
            "default-src ???",
            "default-src 'none' 'self'",
            "default-src {bad}",
        ]:
            score, details = SecurityHeadersService._analyze_directive("content-security-policy", value, 25)
            self.assertEqual(score, 0)
            self.assertEqual(details["status"], "invalid")

    def test_revocation_rechecks_a_previously_authenticated_probe_and_bulk_resume(self):
        from monitoring.probe_management import revoke
        from common.bulk import operate

        raw, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Stale authenticated", token_hash=hashed)
        target = MonitoringTarget.objects.create(
            organization=self.org, name="Private stale", runner_type="agent", agent_probe=probe, endpoint="10.0.0.1:80"
        )
        authenticated = AgentProbeService.authenticate_token(raw)
        revoke(probe.pk, self.org.pk, "Retiro validado", self.admin)
        self.assertEqual(AgentProbeService.process_heartbeat(authenticated), [])
        self.assertEqual(AgentProbeService.ingest_results(authenticated, []), 0)
        result = operate(MonitoringTarget, self.org.pk, "resume", [str(target.pk)], Mock())
        self.assertEqual(result["counts"]["failed"], 1)
        target.refresh_from_db()
        self.assertFalse(target.enabled)

    def test_all_six_directories_at_25_100_1000_are_paged_and_bounded(self):
        from ssl_monitor.models import SSLCertificate
        from domain.models import DomainInfo
        from security_headers.models import SecurityHeaderTarget

        cases = [
            ("monitoring", MonitoringTarget, lambda i: {"name": f"Scale {i}", "endpoint": "https://example.test"}),
            ("ssl-certificates", SSLCertificate, lambda i: {"domain": f"ssl{i}.test"}),
            ("dns-records", DNSRecord, lambda i: {"domain": f"dns{i}.test", "record_type": "A"}),
            ("domains", DomainInfo, lambda i: {"domain": f"domain{i}.test"}),
            ("api-checks", APICheckTarget, lambda i: {"name": f"API {i}", "url": f"https://api{i}.test"}),
            (
                "security-headers",
                SecurityHeaderTarget,
                lambda i: {"name": f"Headers {i}", "url": f"https://headers{i}.test"},
            ),
        ]
        for route, model, fields in cases:
            previous = 0
            small = None
            for size in [25, 100, 1000]:
                model.objects.bulk_create([model(organization=self.org, **fields(i)) for i in range(previous, size)])
                previous = size
                response = self.client.get(f"/api/v1/{route}/?page=1")
                self.assertEqual(response.data["meta"]["total"], size)
                with CaptureQueriesContext(connection) as queries:
                    response = self.client.get(f"/api/v1/{route}/?page=1")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.data["data"]), 25)
                if small is None:
                    small = len(queries)
                self.assertLessEqual(len(queries), small + 2)

    def test_unmeasured_stats_are_unknown_and_retirement_is_available_after_expiry(self):
        from ssl_monitor.services import SSLMonitorService
        from api_checks.services import APICheckService

        self.assertIsNone(DNSMonitorService.get_dns_stats(self.org.pk)["avg_latency_ms"])
        self.assertIsNone(SSLMonitorService.get_certificate_stats(self.org.pk)["avg_days_remaining"])
        self.assertIsNone(APICheckService.get_api_check_stats(self.org.pk)["avg_latency"])
        raw, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Expired retire", token_hash=hashed)
        self.org.subscription_status = "past_due"
        self.org.save()
        response = self.client.post(
            f"/api/v1/agent-probes/{probe.pk}/revoke/", {"reason": "Retiro tras vencer"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(AgentProbeService.authenticate_token(raw))

    def test_rdap_keeps_partial_evidence_and_refuses_oversized_responses(self):
        from domain.rdap import query, read_json

        bootstrap = {"services": [[["test"], ["https://rdap.example.test/"]]]}
        data = {
            "objectClassName": "domain",
            "events": [{"eventAction": "registration", "eventDate": "2020-01-01T00:00:00Z"}],
            "nameservers": [{"ldhName": "NS1.EXAMPLE.TEST"}],
        }
        with patch("domain.rdap.cache") as cache, patch("domain.rdap.read_json", side_effect=[bootstrap, data]):
            cache.get.return_value = None
            result = query("partial.test")
        self.assertTrue(result["success"])
        self.assertEqual(result["data_source"], "rdap")
        self.assertIsNone(result["expiration_date"])
        self.assertIsNone(result["is_locked"])
        self.assertEqual(result["name_servers"], ["ns1.example.test"])
        response = Mock(status_code=200)
        response.iter_content.return_value = [b"x" * (2 * 1024 * 1024 + 1)]
        with patch("domain.rdap.safe_http.get", return_value=response), self.assertRaises(ValueError):
            read_json("https://rdap.example.test/")
        response.close.assert_called_once()

    def test_batch_broker_failure_reports_partial_admission_without_retries(self):
        from common.scan_limits import enqueue_many

        targets = [
            MonitoringTarget.objects.create(organization=self.org, name=f"Batch {i}", endpoint="https://example.test")
            for i in range(2)
        ]
        task = Mock()
        task.delay.side_effect = [SimpleNamespace(id="fixture-one"), OSError("ack lost")]
        result = enqueue_many(targets, task, report=True)
        self.assertEqual(task.delay.call_count, 2)
        self.assertEqual(result["counts"], {"applied": 1, "skipped": 0, "failed": 0, "unknown": 1})
        self.assertEqual(len(result["results"]), 2)

    def test_agent_execution_snapshot_is_scoped_and_contains_no_payload(self):

        _, hashed = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(organization=self.org, name="Receipt", token_hash=hashed)
        target = MonitoringTarget.objects.create(
            organization=self.org,
            name="Private receipt",
            runner_type="agent",
            agent_probe=probe,
            endpoint="10.0.0.1:80",
        )
        receipt = AgentExecution.objects.create(
            organization=self.org,
            probe=probe,
            target=target,
            expires_at=timezone.now() + timedelta(minutes=10),
            payload={"private": "must-not-leak"},
        )
        response = self.client.get("/api/v1/monitoring/?page=1")
        snapshot = response.data["data"][0]["scan_availability"]["execution"]
        self.assertEqual(snapshot["id"], str(receipt.pk))
        self.assertEqual(snapshot["state"], "queued")
        self.assertNotIn("must-not-leak", str(response.data))
        detail = self.client.get(f"/api/v1/scan-executions/{receipt.pk}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["origin"], "agent")
        self.assertNotIn("must-not-leak", str(detail.data))
        other = Organization.objects.create(name="Other receipt", slug="other-receipt")
        stranger = User.objects.create_user("other-receipt@example.test", organization=other, is_staff=True)
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.get(f"/api/v1/scan-executions/{receipt.pk}/").status_code, 404)

    def test_explicit_empty_coverage_needs_no_broker_admission(self):
        from monitoring.provisioning import schedule

        target = MonitoringTarget.objects.create(
            organization=self.org, name="No coverage", endpoint="https://example.test", enabled=False
        )
        with patch("monitoring.tasks.register_target_in_submonitors.delay") as task:
            with self.captureOnCommitCallbacks(execute=True):
                schedule(target, [], self.admin)
        task.assert_not_called()
        target.refresh_from_db()
        self.assertEqual(target.coverage_status, {"state": "completed", "created": [], "existing": [], "failed": {}})
