from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from audit.models import AuditLog
from organizations.models import Organization


@override_settings(ENFORCE_LEGACY_EMAIL_VERIFICATION=False)
class PlatformUsersTests(TestCase):
    def setUp(self):
        self.platform = Organization.objects.create(name="Platform", slug="platform-fixture")
        self.customer = Organization.objects.create(name="Customer", slug="customer-fixture")
        self.root = self.user("root", self.platform, is_superuser=True, is_staff=True)
        self.admin = self.user("customer-admin", self.customer, is_staff=True)
        self.member = self.user("customer-viewer", self.customer)
        self.client = APIClient()
        self.client.force_authenticate(self.root)

    def user(self, name, organization, **fields):
        return User.objects.create_user(f"{name}@example.test", organization=organization,
                                        email_verified_at=timezone.now(), **fields)

    def apply_action(self, user, action):
        return self.client.post(f"/api/v1/platform-admin/users/{user.id}/action/",
                                {"action": action, "reason": "Controlled support fixture"}, format="json")

    def test_only_platform_can_read_and_act(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/platform-admin/users/").status_code, 403)
        self.assertEqual(self.apply_action(self.member, "deactivate").status_code, 403)

    def test_cross_tenant_directory_returns_only_allowed_fields(self):
        result = self.client.get("/api/v1/platform-admin/users/", {"organization_id": self.customer.id})
        self.assertEqual(result.status_code, 200)
        data = result.data["data"]
        self.assertEqual(data["total"], 2)
        self.assertEqual({row["id"] for row in data["users"]}, {self.admin.id, self.member.id})
        self.assertEqual(set(data["users"][0]), {
            "id", "email", "name", "organization_id", "organization_name", "role",
            "is_active", "email_verified", "mfa_enabled", "last_login",
        })

    def test_protects_superadmin_and_last_tenant_admin(self):
        self.assertEqual(self.apply_action(self.root, "deactivate").status_code, 403)
        self.assertEqual(self.apply_action(self.admin, "deactivate").status_code, 400)
        self.assertFalse(AuditLog.objects.filter(module="platform_users").exists())

    def test_revocation_rejects_preexisting_access_token_and_audits_operator(self):
        token = RefreshToken.for_user(self.member)
        token["session_version"] = self.member.session_version
        session = APIClient()
        session.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        self.assertEqual(session.get("/api/v1/auth/me/").status_code, 200)
        self.assertEqual(self.apply_action(self.member, "revoke_sessions").status_code, 200)
        self.assertEqual(session.get("/api/v1/auth/me/").status_code, 401)
        event = AuditLog.objects.get(module="platform_users")
        self.assertEqual(event.organization_id, self.customer.id)
        self.assertEqual(event.user_id, self.root.id)
        self.assertEqual(event.metadata["target_user_id"], str(self.member.id))

    def test_account_can_be_deactivated_and_reactivated(self):
        self.assertEqual(self.apply_action(self.member, "deactivate").status_code, 200)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertEqual(self.apply_action(self.member, "activate").status_code, 200)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_active)
        self.assertEqual(self.member.session_version, 1)

    def test_tenant_role_changes_require_an_effective_admin(self):
        self.assertEqual(self.apply_action(self.admin, "make_viewer").status_code, 400)
        self.assertEqual(self.apply_action(self.member, "make_admin").status_code, 200)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_staff)
        self.assertFalse(self.member.is_superuser)
        self.assertEqual(self.member.session_version, 1)
        self.assertEqual(self.apply_action(self.admin, "make_viewer").status_code, 200)

    def test_organization_details_use_catalog_limits(self):
        result = self.client.get(f"/api/v1/platform-admin/organizations/{self.customer.id}/")
        self.assertEqual(result.status_code, 200)
        data = result.data["data"]
        self.assertEqual(data["users_count"], 2)
        self.assertEqual(data["max_users"], self.customer.get_plan_limits()["max_team_members"])
        self.assertEqual(data["targets_count"], 0)
        self.assertEqual(data["max_targets"], self.customer.get_plan_limits()["max_monitoring_targets"])
