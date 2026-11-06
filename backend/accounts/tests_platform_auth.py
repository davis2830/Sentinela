from datetime import timedelta

import pyotp
from django.contrib.sessions.models import Session
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import APIToken, User
from accounts.platform_auth import session_key
from accounts.services import AuthService
from common.crypto import encrypt_string
from organizations.models import Organization


@override_settings(ENFORCE_LEGACY_EMAIL_VERIFICATION=False)
class PlatformAuthenticationTests(TestCase):
    def setUp(self):
        org = Organization.objects.create(name="Platform session fixture", slug="platform-session-fixture")
        self.secret = pyotp.random_base32()
        self.user = User.objects.create_user(
            "operator@example.test", password="Controlled-platform-test-98!", organization=org,
            is_staff=True, is_superuser=True, email_verified_at=timezone.now(),
            is_2fa_enabled=True, totp_secret=encrypt_string(self.secret),
        )
        self.client = APIClient()

    def login(self):
        return self.client.post("/api/v1/platform-admin/session/login/", {
            "email": self.user.email, "password": "Controlled-platform-test-98!",
        }, format="json")

    def verify(self, challenge, code=None):
        return self.client.post("/api/v1/platform-admin/session/verify/", {
            "challenge": challenge, "code": code or pyotp.TOTP(self.secret).now(),
        }, format="json")

    def session(self):
        challenge = self.login().data["data"]["challenge"]
        result = self.verify(challenge)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["data"]["expires_in"], 600)
        token = result.data["data"]["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return token

    def test_portal_jwt_cannot_open_global_routes(self):
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        for url in ("platform-admin/stats/", "platform-admin/users/", "platform-admin/beta/",
                    "platform-admin/audit-logs/", "auth/beta/admin/", "organizations/"):
            self.assertEqual(self.client.get(f"/api/v1/{url}").status_code, 401, url)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/organizations/current/change-plan/", {
            "plan_tier": "pro",
        }, format="json").status_code, 400)

    def test_platform_session_is_scoped_and_can_be_revoked(self):
        token = self.session()
        stats = self.client.get("/api/v1/platform-admin/stats/")
        self.assertEqual(stats.status_code, 200)
        self.assertEqual(stats["Cache-Control"], "no-store")
        stored_key = Session.objects.get().session_key
        self.assertEqual(stored_key, session_key(token[4:]))
        self.assertNotEqual(stored_key, token[4:])
        copied = APIClient()
        copied.credentials(HTTP_AUTHORIZATION=f"Bearer sap_{stored_key}")
        self.assertEqual(copied.get("/api/v1/platform-admin/stats/").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        self.assertEqual(self.client.post("/api/v1/platform-admin/session/logout/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/platform-admin/stats/").status_code, 401)

    def test_missing_mfa_and_non_superadmin_cannot_start(self):
        self.user.is_2fa_enabled = False
        self.user.save(update_fields=["is_2fa_enabled"])
        self.assertEqual(self.login().status_code, 403)
        self.user.is_superuser = False
        self.user.save(update_fields=["is_superuser"])
        self.assertEqual(self.login().status_code, 401)
        self.assertFalse(Session.objects.exists())

    def test_challenge_and_totp_cannot_be_replayed(self):
        challenge = self.login().data["data"]["challenge"]
        other_challenge = self.login().data["data"]["challenge"]
        code = pyotp.TOTP(self.secret).now()
        self.assertEqual(self.verify(challenge, code).status_code, 200)
        self.assertEqual(self.verify(challenge, code).status_code, 429)
        self.assertEqual(self.verify(other_challenge, code).status_code, 429)
        self.assertEqual(Session.objects.count(), 1)

    def test_customer_challenge_cannot_be_exchanged_for_admin_session(self):
        challenge = AuthService.login(self.user.email, "Controlled-platform-test-98!")["pre_auth_token"]
        self.assertEqual(self.verify(challenge).status_code, 401)

    def test_expired_session_and_password_change_invalidate_access(self):
        token = self.session()
        Session.objects.filter(session_key=session_key(token[4:])).update(expire_date=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get("/api/v1/platform-admin/stats/").status_code, 401)
        Session.objects.filter(session_key=session_key(token[4:])).update(expire_date=timezone.now() + timedelta(minutes=2))
        self.user.set_password("Controlled-platform-test-99!")
        self.user.save(update_fields=["password"])
        self.assertEqual(self.client.get("/api/v1/platform-admin/stats/").status_code, 401)

    def test_portal_session_cannot_replace_or_disable_superadmin_factor(self):
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.post("/api/v1/auth/2fa/setup/", {"reset": True}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/auth/2fa/disable/", {
            "password": "Controlled-platform-test-98!",
        }, format="json").status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_2fa_enabled)

    def test_superadmin_enrollment_requires_password_at_both_steps(self):
        self.user.is_2fa_enabled = False
        self.user.totp_secret = ""
        self.user.save(update_fields=["is_2fa_enabled", "totp_secret"])
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        setup_url = "/api/v1/auth/2fa/setup/"
        verify_url = "/api/v1/auth/2fa/verify/"
        self.assertEqual(self.client.post(setup_url, [], format="json").status_code, 400)
        self.assertEqual(self.client.post(verify_url, [], format="json").status_code, 400)
        self.assertEqual(self.client.post(setup_url, {}, format="json").status_code, 400)
        setup = self.client.post(setup_url, {"password": "Controlled-platform-test-98!"}, format="json")
        self.assertEqual(setup.status_code, 200)
        self.assertEqual(setup["Cache-Control"], "no-store")
        code = pyotp.TOTP(setup.data["data"]["secret"]).now()
        self.assertEqual(self.client.post(verify_url, {"code": code}, format="json").status_code, 400)
        verified = self.client.post(verify_url, {
            "code": code, "password": "Controlled-platform-test-98!",
        }, format="json")
        self.assertEqual(verified.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_2fa_enabled)

    def test_tenant_admin_cannot_mutate_same_tenant_superadmin(self):
        admin = User.objects.create_user(
            "tenant-admin@example.test", organization=self.user.organization, is_staff=True,
            email_verified_at=timezone.now(),
        )
        self.client.force_authenticate(admin)
        user_url = f"/api/v1/users/{self.user.pk}/"
        self.assertEqual(self.client.patch(user_url, {"is_active": False}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(user_url).status_code, 400)
        self.assertEqual(self.client.delete(f"/api/v1/organizations/members/{self.user.pk}/").status_code, 400)
        for action in ("activate", "deactivate", "delete"):
            response = self.client.post("/api/v1/organizations/members/bulk-action/", {
                "action": action, "member_ids": [str(self.user.pk)],
            }, format="json")
            self.assertEqual(response.status_code, 400, action)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_native_django_admin_is_unpublished(self):
        self.assertEqual(self.client.get("/admin/login/").status_code, 404)

    def test_api_token_cannot_enroll_factor_or_open_platform(self):
        self.user.is_2fa_enabled = False
        self.user.save(update_fields=["is_2fa_enabled"])
        _, token = APIToken.issue(user=self.user, name="controlled-fixture")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get("/api/v1/platform-admin/stats/").status_code, 401)
        self.assertEqual(self.client.post("/api/v1/auth/2fa/setup/", {
            "password": "Controlled-platform-test-98!",
        }, format="json").status_code, 403)
