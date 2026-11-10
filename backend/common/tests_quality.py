"""F02/F04/F05/F06/F08 reproductions become enforced regressions."""

from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from accounts.models import APIToken, User
from common.authorization import AuthorizedAPIView, effective_permissions
from common.responses import success_response
from organizations.models import InvitationToken, Organization
from users.authorization import configure, validate_codes
from users.models import Role, UserRole


class QualityTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Quality", slug="quality", plan_tier="pro")
        self.other = Organization.objects.create(name="Foreign", slug="foreign-quality")
        self.admin = User.objects.create_user("admin@quality.test", organization=self.org, is_staff=True)
        self.member = User.objects.create_user("member@quality.test", organization=self.org)
        self.role = Role.objects.create(organization=self.org, name="Operator")
        UserRole.objects.create(user=self.member, role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def enable(self, *codes):
        self.role.permissions.set(validate_codes(codes))
        self.member.authorization_mode = "custom"
        self.member.save()
        self.client.force_authenticate(self.member)

    def test_billing_never_fabricates_payments_for_any_subscription(self):
        for state in ("active", "trialing", "past_due", "canceled"):
            self.org.subscription_status = state
            self.org.save()
            response = self.client.get("/api/v1/organizations/current/invoices/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"], [])
            self.assertIs(response.data["meta"]["billing_available"], False)

    def test_unhandled_value_errors_are_internal_and_safe(self):
        with patch("users.services.UserService.list_users", side_effect=ValueError("PRIVATE_INTERNAL_VALUE")):
            response = self.client.get("/api/v1/users/")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("PRIVATE_INTERNAL_VALUE", str(response.data))
        self.assertIn("X-Correlation-ID", response)

    def test_internal_failure_is_safe_and_correlated(self):
        with patch("users.services.UserService.create_user", side_effect=RuntimeError("PRIVATE_DB_PASSWORD")):
            response = self.client.post(
                "/api/v1/users/", {"email": "new@quality.test", "password": "Test-Password-123!"}, format="json"
            )
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("PRIVATE_DB_PASSWORD", str(response.data))
        self.assertEqual(response["X-Correlation-ID"], response.data["errors"]["correlation_id"])
        with patch("users.services.RoleService.get_role", side_effect=RuntimeError("PRIVATE_DB_PASSWORD")):
            response = self.client.get(f"/api/v1/users/roles/{self.role.pk}/")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("PRIVATE_DB_PASSWORD", str(response.data))

    def test_user_directory_pages_and_bounded_queries(self):
        User.objects.bulk_create([User(email=f"quality-{i}@test.test", organization=self.org) for i in range(30)])
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/v1/users/?page=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 25)
        self.assertLessEqual(len(queries), 5)
        page2 = self.client.get("/api/v1/users/?page=2")
        self.assertEqual(len(page2.data["data"]), 7)
        self.assertEqual(page2.data["meta"]["total"], 32)
        self.assertEqual(len(self.client.get("/api/v1/users/").data["data"]), 32)
        self.assertEqual(len(self.client.get("/api/v1/users/?page=1&search=quality-1").data["data"]), 11)

    def test_unified_directory_deduplicates_before_paging(self):
        User.objects.bulk_create([User(email=f"member-{i}@test.test", organization=self.org) for i in range(28)])
        duplicate = InvitationToken.create_invitation(self.org, "MEMBER-0@test.test")
        InvitationToken.create_invitation(self.org, "pending@test.test")
        InvitationToken.create_invitation(self.org, "pending@test.test")
        expired = InvitationToken.create_invitation(self.org, "expired@test.test")
        expired.expires_at = timezone.now() - timedelta(days=1)
        expired.save()
        with CaptureQueriesContext(connection) as queries:
            first = self.client.get("/api/v1/organizations/members/?page=1")
        self.assertEqual(first.status_code, 200, first.data)
        second = self.client.get("/api/v1/organizations/members/?page=2")
        combined = first.data["data"] + second.data["data"]
        self.assertEqual(first.data["meta"]["total"], 31)
        self.assertEqual(len(first.data["data"]), 25)
        self.assertEqual(len({item["id"] for item in combined}), 31)
        self.assertNotIn(str(duplicate.pk), {item["id"] for item in combined})
        self.assertEqual(sum(item["email"] == "pending@test.test" for item in combined), 1)
        self.assertLessEqual(len(queries), 10)
        pending = self.client.get("/api/v1/organizations/members/?page=1&status=pending&search=pending")
        self.assertEqual(len(pending.data["data"]), 1)
        self.assertEqual(self.client.get("/api/v1/organizations/members/?page=-1").status_code, 400)

    def test_legacy_roles_stay_inactive_and_custom_unknown_denied(self):
        self.role.permissions.set(validate_codes(["monitoring.create"]))
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post("/api/v1/monitoring/", {}, format="json").status_code, 403)
        self.assertTrue(all(code.endswith(".read") for code in effective_permissions(self.member)))
        self.enable("monitoring.create")
        self.assertEqual(self.client.get("/api/v1/monitoring/").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/monitoring/", {}, format="json").status_code, 400)

        class UnknownView(AuthorizedAPIView):
            __module__ = "monitoring.views"

            def post(self, request):
                return success_response({})

        request = APIRequestFactory().post("/unknown/", {}, format="json")
        force_authenticate(request, self.member)
        self.assertEqual(UnknownView.as_view()(request).status_code, 403)

    def test_every_module_has_enforced_read_and_write(self):
        routes = {
            "monitoring": "monitoring",
            "ssl_monitor": "ssl-certificates",
            "dns_monitor": "dns-records",
            "domain": "domains",
            "api_checks": "api-checks",
            "security_headers": "security-headers",
            "alerts": "alert-rules",
            "notifications": "notifications/channels",
            "incidents": "incidents",
            "maintenance": "maintenance",
            "reports": "reports",
            "status_page": "status-page/pages",
        }
        self.enable()
        for module, route in routes.items():
            with self.subTest(module=module):
                self.role.permissions.clear()
                self.assertEqual(self.client.get(f"/api/v1/{route}/").status_code, 403)
                self.role.permissions.set(validate_codes([f"{module}.read"]))
                self.assertEqual(self.client.get(f"/api/v1/{route}/").status_code, 200)
                self.assertEqual(self.client.post(f"/api/v1/{route}/", {}, format="json").status_code, 403)
                self.role.permissions.set(validate_codes([f"{module}.create"]))
                self.assertEqual(self.client.post(f"/api/v1/{route}/", {}, format="json").status_code, 400)

    def test_bulk_delete_requires_delete_not_scan_and_read_tokens_stay_read_only(self):
        from monitoring.models import MonitoringTarget

        target = MonitoringTarget.objects.create(
            name="Keep", organization=self.org, target_type="http", endpoint="https://example.com"
        )
        foreign = MonitoringTarget.objects.create(
            name="Foreign", organization=self.other, target_type="http", endpoint="https://example.org"
        )
        self.enable("monitoring.scan")
        payload = {"action": "delete", "target_ids": [str(target.pk), str(foreign.pk)]}
        self.assertEqual(self.client.post("/api/v1/monitoring/bulk-action/", payload, format="json").status_code, 403)
        self.role.permissions.set(validate_codes(["monitoring.delete"]))
        self.assertEqual(self.client.post("/api/v1/monitoring/bulk-action/", payload, format="json").status_code, 200)
        self.assertTrue(MonitoringTarget.objects.filter(pk=foreign.pk).exists())
        _, token = APIToken.issue(user=self.member, name="Read", scope="read")
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.post("/api/v1/monitoring/bulk-action/", payload, format="json").status_code, 403)

    def test_activation_requires_admin_reason_audit_and_revokes_sessions(self):
        self.role.permissions.set(validate_codes(["monitoring.read"]))
        url = f"/api/v1/users/{self.member.pk}/authorization/"
        self.assertEqual(self.client.put(url, {"authorization_mode": "custom"}, format="json").status_code, 400)
        response = self.client.put(
            url,
            {"authorization_mode": "custom", "reason": "Approved operator", "role_ids": [str(self.role.pk)]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.session_version, 1)
        self.assertEqual(self.member.authorization_mode, "custom")
        from audit.models import AuditLog

        self.assertTrue(AuditLog.objects.filter(metadata__reason="Approved operator").exists())
        self.assertEqual(
            self.client.put(
                f"/api/v1/users/{self.admin.pk}/authorization/",
                {"authorization_mode": "custom", "reason": "attempt"},
                format="json",
            ).status_code,
            400,
        )
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.put(url, {"authorization_mode": "legacy", "reason": "attempt"}, format="json").status_code, 403
        )
        self.assertEqual(
            self.client.patch(
                "/api/v1/auth/me/", {"authorization_mode": "legacy", "is_staff": True}, format="json"
            ).status_code,
            200,
        )
        self.member.refresh_from_db()
        self.assertEqual(self.member.authorization_mode, "custom")
        self.assertFalse(self.member.is_staff)

    def test_foreign_roles_and_reserved_permissions_cannot_grant_access(self):
        other_role = Role.objects.create(organization=self.other, name="Other")
        self.assertEqual(
            self.client.put(
                f"/api/v1/users/{self.member.pk}/authorization/",
                {"authorization_mode": "custom", "reason": "test", "role_ids": [str(other_role.pk)]},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/users/roles/",
                {"name": "Unsafe", "permission_codes": ["users.manage", "platform_admin.read"]},
                format="json",
            ).status_code,
            400,
        )

    def test_plan_catalog_matches_effective_beta_limits(self):
        self.org.beta_managed = True
        self.org.plan_tier = "free"
        self.org.save()
        data = self.client.get("/api/v1/organizations/current/plans/").data["data"]
        self.assertEqual(data[0]["limits"], self.org.get_plan_limits())
        self.assertEqual(data[0]["limits"]["max_monitoring_targets"], 3)
        self.assertNotIn("enterprise", [item["tier"] for item in data])

    def test_directory_query_cost_is_constant_at_five_twenty_five_and_thirty(self):
        costs = []
        for size in (5, 25, 30):
            User.objects.filter(organization=self.org).exclude(pk__in=[self.admin.pk, self.member.pk]).delete()
            User.objects.bulk_create(
                [User(email=f"cost-{i}@quality.test", organization=self.org) for i in range(size - 2)]
            )
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get("/api/v1/users/?page=1")
            self.assertEqual(len(response.data["data"]), min(size, 25))
            self.assertEqual(response.data["meta"]["total"], size)
            costs.append(len(queries))
        self.assertEqual(len(set(costs)), 1)
        self.assertLessEqual(max(costs), 5)

    def test_role_changes_revoke_only_affected_custom_sessions(self):
        configure(actor=self.admin, user_id=self.member.pk, mode="custom", reason="Fixture activation")
        self.member.refresh_from_db()
        previous = self.member.session_version
        response = self.client.patch(
            f"/api/v1/users/roles/{self.role.pk}/",
            {"permission_codes": ["ssl_monitor.read"], "reason": "Restrict operator"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.session_version, previous + 1)
        self.assertEqual(effective_permissions(self.member), ["ssl_monitor.read"])
        self.assertEqual(self.admin.session_version, 0)

    def test_transport_allowlist_preserves_delivery_results(self):
        from notifications.models import Notification, NotificationChannel
        from notifications.transports import deliver, transport_registry

        for kind, transport in transport_registry().items():
            with (
                self.subTest(kind=kind),
                patch.object(transport, "send", return_value=("fixture delivered", 202, 12)) as send,
            ):
                channel = NotificationChannel(channel_type=kind)
                event = Notification(title="Fixture")
                result = deliver(channel, event)
                send.assert_called_once_with(channel, event)
                self.assertEqual((result.response, result.status, result.duration_ms), ("fixture delivered", 202, 12))
        with self.assertRaises(ValueError):
            deliver(NotificationChannel(channel_type="unregistered"), Notification(title="Fixture"))

    def test_evaluation_failure_is_a_failed_job_and_does_not_poison_other_rules(self):
        from alerts.models import AlertRule
        from alerts.services import AlertEvaluatorService
        from alerts.tasks import evaluate_alert_rules

        for index in range(2):
            AlertRule.objects.create(
                organization=self.org, name=f"Fixture rule {index}", target_type="monitoring", condition="status_down"
            )
        with patch.object(
            AlertEvaluatorService, "_evaluate_rule", side_effect=[RuntimeError("fixture failure"), False]
        ) as evaluate:
            with self.assertRaises(RuntimeError):
                AlertEvaluatorService.evaluate_all_rules(self.org.pk)
            self.assertEqual(evaluate.call_count, 2)
        with patch.object(AlertEvaluatorService, "evaluate_all_rules", side_effect=RuntimeError("fixture failure")):
            result = evaluate_alert_rules.apply(throw=False)
        self.assertTrue(result.failed())

    def test_api_token_database_failure_is_not_misreported_as_invalid_credentials(self):
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer snt_controlled_fixture")
        with patch(
            "accounts.authentication.APIToken.objects.select_related",
            side_effect=RuntimeError("PRIVATE_TOKEN_DATABASE_FAILURE"),
        ):
            response = self.client.get("/api/v1/monitoring/")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("PRIVATE_TOKEN_DATABASE_FAILURE", str(response.data))
        self.assertIn("X-Correlation-ID", response)

    def test_role_definition_is_audited_and_duplicate_names_are_conflicts(self):
        body = {"name": "Audited Operator", "permission_codes": ["monitoring.read"], "reason": "New operational role"}
        response = self.client.post("/api/v1/users/roles/", body, format="json")
        self.assertEqual(response.status_code, 201)
        from audit.models import AuditLog

        self.assertTrue(AuditLog.objects.filter(action="create", metadata__reason="New operational role").exists())
        duplicate = self.client.post("/api/v1/users/roles/", body, format="json")
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(duplicate.data["errors"]["code"], "CONFLICT")

    def test_monitoring_creation_requires_explicit_related_module_rights(self):
        from types import SimpleNamespace
        from monitoring.serializers import MonitoringTargetCreateSerializer

        self.enable("monitoring.create", "ssl_monitor.create")
        base = {"name": "Fixture", "target_type": "https", "endpoint": "https://example.com"}
        for opt_in, expected in ((False, []), (True, ["ssl"])):
            serializer = MonitoringTargetCreateSerializer(
                data={**base, "auto_coverage": opt_in}, context={"request": SimpleNamespace(user=self.member)}
            )
            with patch("common.security.validate_safe_target_endpoint", side_effect=lambda value: value):
                self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.validated_data["related_modules"], expected)
        self.role.permissions.set(validate_codes(["monitoring.create"]))
        self.assertEqual(
            self.client.post("/api/v1/monitoring/", {**base, "related_modules": ["ssl"]}, format="json").status_code,
            403,
        )
        self.assertEqual(self.client.post("/api/v1/monitoring/", [], format="json").status_code, 400)

    def test_deferred_provisioning_rechecks_operator_permissions(self):
        from monitoring.models import MonitoringTarget
        from monitoring.tasks import register_target_in_submonitors
        from ssl_monitor.models import SSLCertificate

        target = MonitoringTarget.objects.create(
            organization=self.org, name="Fixture", target_type="https", endpoint="https://example.com"
        )
        self.enable("monitoring.create")
        result = register_target_in_submonitors.run(str(target.pk), ["ssl"], str(self.member.pk))
        self.assertEqual(result["failed"], {"ssl": "authorization_changed"})
        self.assertFalse(SSLCertificate.objects.filter(organization=self.org).exists())

    def test_endpoint_coverage_cannot_disclose_other_modules(self):
        from monitoring.models import MonitoringTarget, TargetCoverage
        from ssl_monitor.models import SSLCertificate
        from audit.models import AuditLog

        target = MonitoringTarget.objects.create(
            organization=self.org, name="Fixture", target_type="https", endpoint="https://example.com"
        )
        certificate = SSLCertificate.objects.create(organization=self.org, domain="example.com")
        TargetCoverage.objects.create(target=target, ssl=certificate)
        AuditLog.objects.create(
            organization_id=self.org.pk,
            action="update",
            module="monitoring",
            description="Private audit",
            metadata={"target_id": str(target.pk)},
        )
        self.enable("monitoring.read", "monitoring.update")
        url = f"/api/v1/monitoring/{target.pk}/coverage/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            all(
                section["status"] == "restricted" and not section["resources"] and not section["candidates"]
                for section in response.data["data"]["sections"].values()
            )
        )
        self.assertEqual(response.data["data"]["activity"], {"alerts": [], "incidents": [], "changes": []})
        self.assertEqual(self.client.patch(url, {"ssl": []}, format="json").status_code, 403)
        self.role.permissions.set(validate_codes(["monitoring.read", "ssl_monitor.read"]))
        section = self.client.get(url).data["data"]["sections"]["ssl"]
        self.assertEqual(section["status"], "linked")
        self.assertEqual(section["resources"][0]["id"], str(certificate.pk))

    def test_status_page_target_picker_respects_source_module_rights(self):
        from monitoring.models import MonitoringTarget
        from api_checks.models import APICheckTarget

        target = MonitoringTarget.objects.create(organization=self.org, name="Fixture", endpoint="https://example.com")
        APICheckTarget.objects.create(organization=self.org, name="Hidden API", url="https://example.com/api")
        self.enable("status_page.read")
        self.assertEqual(self.client.get("/api/v1/status-page/available-targets/").data["data"], [])
        self.role.permissions.set(validate_codes(["status_page.read", "monitoring.read"]))
        response = self.client.get("/api/v1/status-page/available-targets/")
        self.assertEqual([item["id"] for item in response.data["data"]], [str(target.pk)])
        self.role.permissions.set(validate_codes(["status_page.update"]))
        self.assertEqual(
            self.client.patch(
                "/api/v1/status-page/config/", {"monitored_targets": [str(target.pk)]}, format="json"
            ).status_code,
            403,
        )

    def test_state_transitions_cannot_bypass_specific_actions(self):
        from uuid import uuid4

        missing = uuid4()
        self.enable("status_page.update", "maintenance.update", "incidents.update")
        for route, body in (
            (f"status-page/maintenances/{missing}/", {"status": "completed"}),
            (f"status-page/maintenances/{missing}/updates/", {"message": "Done", "status": "completed"}),
            ("status-page/maintenances/bulk-action/", {"action": "completed", "ids": [str(missing)]}),
            (f"maintenance/{missing}/", {"status": "completed"}),
            (f"incidents/{missing}/", {"status": "resolved"}),
        ):
            with self.subTest(route=route):
                method = self.client.post if route.endswith(("updates/", "bulk-action/")) else self.client.patch
                self.assertEqual(method("/api/v1/" + route, body, format="json").status_code, 403)
        self.enable("status_page.create", "maintenance.create")
        for route in ("status-page/maintenances/", "maintenance/"):
            self.assertEqual(
                self.client.post("/api/v1/" + route, {"status": "completed"}, format="json").status_code, 403
            )

    def test_scan_availability_supports_custom_operators_with_bounded_queries(self):
        from monitoring.models import MonitoringTarget

        MonitoringTarget.objects.bulk_create(
            [
                MonitoringTarget(organization=self.org, name=f"Fixture {i}", endpoint="https://example.com")
                for i in range(25)
            ]
        )
        self.enable("monitoring.read")
        listing = self.client.get("/api/v1/monitoring/")
        self.assertTrue(all(item["scan_availability"]["status"] == "read_only" for item in listing.data["data"]))
        self.role.permissions.set(validate_codes(["monitoring.read", "monitoring.scan"]))
        with CaptureQueriesContext(connection) as queries:
            listing = self.client.get("/api/v1/monitoring/")
        self.assertTrue(all(item["scan_availability"]["status"] == "ready" for item in listing.data["data"]))
        self.assertLessEqual(len(queries), 10)

    def test_creating_incident_from_alert_requires_both_modules(self):
        from uuid import uuid4

        url = f"/api/v1/alerts/{uuid4()}/create-incident/"
        for permissions in (["alerts.update"], ["incidents.create"]):
            self.enable(*permissions)
            self.assertEqual(self.client.post(url, {}, format="json").status_code, 403)

    def test_global_search_requires_every_module_it_returns(self):
        self.enable("monitoring.read", "ssl_monitor.read", "dns_monitor.read", "api_checks.read")
        self.assertEqual(self.client.get("/api/v1/monitoring/search/?q=fixture").status_code, 403)
        self.enable(
            "monitoring.read",
            "ssl_monitor.read",
            "dns_monitor.read",
            "api_checks.read",
            "alerts.read",
            "incidents.read",
        )
        self.assertEqual(self.client.get("/api/v1/monitoring/search/?q=fixture").status_code, 200)
