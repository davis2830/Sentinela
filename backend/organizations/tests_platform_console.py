from datetime import timedelta
from django.test import TestCase, override_settings
from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from accounts.models import User, BetaControl
from audit.models import AuditLog
from organizations.models import Organization


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PlatformConsoleTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Customer", slug="console-customer", plan_tier="pro", subscription_status="active"
        )
        self.root = User.objects.create_user("console-root@example.test", is_superuser=True, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.root)
        self.prefix = "/api/v1/platform-admin/"

    def test_classification_is_manual_and_stats_exclude_only_marked(self):
        self.assertFalse(self.org.is_test)
        path = f"{self.prefix}organizations/{self.org.id}/classification/"
        self.assertEqual(self.client.post(path, {"is_test": True}).status_code, 400)
        response = self.client.post(path, {"is_test": True, "reason": "Controlled test classification"})
        self.assertEqual(response.status_code, 200)
        self.org.refresh_from_db()
        self.assertTrue(self.org.is_test)
        self.assertEqual(self.org.plan_tier, "pro")
        self.assertEqual(self.client.get(self.prefix + "stats/").data["data"]["organizations"]["total"], 0)
        self.assertEqual(
            self.client.get(self.prefix + "stats/", {"classification": "all"}).data["data"]["organizations"]["total"], 1
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.org.id, description__contains="Controlled test classification"
            ).exists()
        )

    def test_mutations_require_reason_and_record_changes(self):
        base = f"{self.prefix}organizations/{self.org.id}/"
        for suffix, payload in [
            ("set-plan/", {"plan_tier": "free"}),
            ("extend-trial/", {"days": 3}),
            ("toggle-status/", {"action": "suspend"}),
        ]:
            self.assertEqual(self.client.post(base + suffix, payload).status_code, 400)
            self.assertEqual(
                self.client.post(base + suffix, {**payload, "reason": "Controlled support"}).status_code, 200
            )
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan_tier, "free")
        self.assertEqual(self.org.subscription_status, "trialing")
        self.assertEqual(self.org.status, "suspended")
        self.assertEqual(
            self.client.post(
                base + "toggle-status/", {"action": "reactivate", "reason": "Controlled support"}
            ).status_code,
            200,
        )
        self.assertEqual(
            AuditLog.objects.filter(organization_id=self.org.id, description__contains="Controlled support").count(), 4
        )

    def test_directory_pages_filters_and_constant_queries(self):
        Organization.objects.bulk_create([Organization(name=f"Fixture {n}", slug=f"console-{n}") for n in range(30)])
        with CaptureQueriesContext(connection) as queries:
            first = self.client.get(self.prefix + "organizations/", {"page": 1}).data["data"]
        self.assertEqual(len(first), 25)
        self.assertLess(len(queries), 10)
        second = self.client.get(self.prefix + "organizations/", {"page": 2}).data["data"]
        self.assertEqual(len(second), 6)
        self.assertFalse({r["id"] for r in first} & {r["id"] for r in second})
        self.assertEqual(self.client.get(self.prefix + "organizations/", {"page": 0}).status_code, 400)

    def test_lazy_detail_does_not_return_other_sections(self):
        User.objects.create_user("member@example.test", organization=self.org)
        url = f"{self.prefix}organizations/{self.org.id}/"
        general = self.client.get(url, {"section": "general"}).data["data"]
        self.assertEqual(general["users"], [])
        self.assertEqual(general["counts"]["users"], 1)
        users = self.client.get(url, {"section": "users"}).data["data"]
        self.assertEqual(len(users["users"]), 1)
        self.assertEqual(users["targets"], [])

    def test_export_is_filtered_and_sanitized(self):
        Organization.objects.create(name="=FORMULA", slug="console-test", is_test=True)
        result = self.client.get(self.prefix + "export-csv/", {"classification": "tests"})
        self.assertContains(result, "'=FORMULA")
        self.assertNotContains(result, "console-customer")

    def test_user_filters(self):
        User.objects.create_user(
            "viewer@example.test", organization=self.org, email_verified_at=timezone.now(), is_2fa_enabled=True
        )
        result = self.client.get(self.prefix + "users/", {"role": "viewer", "verified": True, "mfa": True}).data["data"]
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["users"][0]["email"], "viewer@example.test")

    def test_beta_configuration_changes_are_independent(self):
        control, _ = BetaControl.objects.get_or_create(pk=1, defaults={"capacity": 20})
        self.assertEqual(
            self.client.post(
                self.prefix + "beta/", {"action": "configure", "capacity": 30, "reason": "Test capacity"}
            ).status_code,
            200,
        )
        control.refresh_from_db()
        before = control.capacity
        self.assertEqual(
            self.client.post(
                self.prefix + "beta/", {"action": "configure", "admissions_open": False, "reason": "Test close"}
            ).status_code,
            200,
        )
        control.refresh_from_db()
        self.assertEqual(control.capacity, before)
        self.assertFalse(control.admissions_open)

    def test_audit_date_filters_and_safe_detail(self):
        entry = AuditLog.objects.create(
            organization_id=self.org.id, action="login", module="accounts", metadata={"password": "must-not-return"}
        )
        detail = self.client.get(self.prefix + f"audit-logs/{entry.id}/").data["data"]
        self.assertNotIn("metadata", detail)
        self.assertNotIn("must-not-return", str(detail))
        result = self.client.get(
            self.prefix + "audit-logs/",
            {
                "page": 1,
                "organization_id": self.org.id,
                "since": (timezone.now() - timedelta(days=1)).isoformat(),
                "until": timezone.now().isoformat(),
            },
        )
        self.assertEqual(len(result.data["data"]["events"]), 1)

    def test_new_admin_routes_reject_non_platform_users(self):
        self.root.is_superuser = False
        self.root.save()
        for path in ["catalog/", "audit-options/", f"organizations/{self.org.id}/?section=general"]:
            self.assertEqual(self.client.get(self.prefix + path).status_code, 403)
