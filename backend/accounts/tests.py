import uuid
from datetime import timedelta
from django.test import TestCase, RequestFactory
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from accounts.models import User, APIToken
from accounts.authentication import SentinelAPITokenAuthentication
from organizations.models import Organization, OrganizationPlanTier, OrganizationSubscriptionStatus
from organizations.services import OrganizationService
from common.middleware import IPAllowlistMiddleware


class RegistrationPlanTests(TestCase):
    def test_api_checks_enforce_free_frequency_on_create_and_update(self):
        from unittest.mock import patch
        org = Organization.objects.create(name="Free API", slug="free-api")
        user = User.objects.create_user(email="free-api@example.test", password="Test-Password-123!", organization=org, is_staff=True)
        client = APIClient()
        client.force_authenticate(user)
        data = {"name": "API", "url": "https://8.8.8.8/health"}
        self.assertEqual(client.post("/api/v1/api-checks/", {**data, "check_interval": 60}, format="json").status_code, 403)
        with patch("api_checks.tasks.run_api_check.delay"):
            response = client.post("/api/v1/api-checks/", data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["check_interval"], 300)
        target_id = response.data["data"]["id"]
        self.assertEqual(client.patch(f"/api/v1/api-checks/{target_id}/", {"check_interval": 60}, format="json").status_code, 403)

    @override_settings(DEBUG=True, TURNSTILE_SECRET_KEY="", PUBLIC_APP_URL="http://localhost:3001", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_registration_always_starts_on_free_without_pro_trial(self):
        from accounts import beta
        from accounts.models import BetaControl, IdentityMail
        from accounts.tasks import deliver_identity_mail
        from common.crypto import decrypt_string
        BetaControl.objects.filter(pk=1).update(admissions_open=True)
        inv = beta.issue_invitation(None, "free-registration@example.test", "Registration regression")
        invitation_token = decrypt_string(IdentityMail.objects.get(invitation=inv).encrypted_body).split("#token=")[1].split("\n")[0]
        client = APIClient()
        response = client.post("/api/v1/auth/register/", {
            "email": "free-registration@example.test", "password": "Strong-Alpha-482!Password",
            "organization_name": "Free Registration", "plan_tier": "pro", "subscription_status": "active",
            "invitation_token": invitation_token,
        }, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        user = User.objects.get(email="free-registration@example.test")
        self.assertIsNone(user.organization_id)
        mail = IdentityMail.objects.get(challenge__user=user)
        confirmation = decrypt_string(mail.encrypted_body).split("#token=")[1].split("\n")[0]
        deliver_identity_mail(str(mail.pk))
        beta.verify(confirmation)
        user.refresh_from_db()
        org = user.organization
        self.assertEqual(org.plan_tier, "free")
        self.assertEqual(org.subscription_status, "active")
        self.assertIsNone(org.trial_ends_at)
        self.assertFalse(org.is_in_trial)
        self.assertEqual(org.default_scan_interval_seconds, 300)
        client.force_authenticate(user)
        blocked = client.post("/api/v1/monitoring/", {"name": "Too fast", "target_type": "https", "endpoint": "https://8.8.8.8", "interval": 60}, format="json")
        self.assertEqual(blocked.status_code, 403)
        created = client.post("/api/v1/monitoring/", {"name": "Default frequency", "target_type": "https", "endpoint": "https://8.8.8.8", "related_modules": []}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["data"]["interval"], 300)
        upgrade = client.post("/api/v1/organizations/current/change-plan/", {"plan_tier": "pro"}, format="json")
        self.assertFalse(upgrade.status_code < 400)
        org.refresh_from_db()
        self.assertEqual(org.plan_tier, "free")

    def test_pro_requires_at_least_sixty_seconds_and_defaults_to_sixty(self):
        org = Organization.objects.create(name="Paid Pro", slug="paid-pro", plan_tier="pro", subscription_status="active")
        user = User.objects.create_user(email="paid-pro@example.test", password="Test-Password-123!", organization=org, is_staff=True)
        client = APIClient()
        client.force_authenticate(user)
        data = {"name": "Pro monitor", "target_type": "https", "endpoint": "https://8.8.8.8", "related_modules": []}
        self.assertEqual(client.post("/api/v1/monitoring/", {**data, "interval": 30}, format="json").status_code, 403)
        response = client.post("/api/v1/monitoring/", data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["interval"], 60)


class SecurityAndAuthTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="Acme Corp",
            slug=f"acme-{uuid.uuid4().hex[:6]}",
            plan_tier=OrganizationPlanTier.PRO,
            subscription_status=OrganizationSubscriptionStatus.TRIALING,
        )
        self.user = User.objects.create_user(
            email="admin@acme.com",
            password="SecurePassword123!",
            organization=self.org,
            is_staff=True,
        )

    def test_api_token_authentication_success(self):
        api_token, raw_token = APIToken.issue(
            user=self.user,
            name="CI Token",
            scope="full",
        )
        request = self.factory.get("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        auth = SentinelAPITokenAuthentication()
        user, token = auth.authenticate(request)
        self.assertEqual(user, self.user)
        self.assertEqual(token, api_token)

    def test_api_token_read_only_scope_blocks_post(self):
        _, raw_token = APIToken.issue(
            user=self.user,
            name="Read Token",
            scope="read",
        )
        request = self.factory.post("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        auth = SentinelAPITokenAuthentication()
        with self.assertRaises(PermissionDenied):
            auth.authenticate(request)

    def test_api_token_expired_rejected(self):
        _, raw_token = APIToken.issue(
            user=self.user,
            name="Expired Token",
            scope="full",
            expires_at=timezone.now() - timedelta(days=1),
        )
        request = self.factory.get("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        auth = SentinelAPITokenAuthentication()
        with self.assertRaises(AuthenticationFailed):
            auth.authenticate(request)

    def test_plan_change_requires_superuser_or_payment_for_enterprise(self):
        # Non-superuser attempting to switch to enterprise without payment should fail
        with self.assertRaises(ValueError):
            OrganizationService.change_plan(self.org.id, OrganizationPlanTier.ENTERPRISE, is_superuser=False)

        # Superuser can change to enterprise
        updated = OrganizationService.change_plan(self.org.id, OrganizationPlanTier.ENTERPRISE, is_superuser=True)
        self.assertEqual(updated.plan_tier, OrganizationPlanTier.ENTERPRISE)
        self.assertEqual(updated.subscription_status, OrganizationSubscriptionStatus.ACTIVE)

    def test_ip_allowlist_anti_spoofing(self):
        middleware = IPAllowlistMiddleware(get_response=lambda r: None)
        # Attacker injects fake localhost in X-Forwarded-For
        request = self.factory.get(
            "/api/v1/monitoring-targets/",
            HTTP_X_FORWARDED_FOR="127.0.0.1",
            REMOTE_ADDR="198.51.100.5",
        )
        client_ip = middleware._get_client_ip(request)
        # Should not fall back to forged 127.0.0.1
        self.assertEqual(client_ip, "198.51.100.5")

    @override_settings(TRUSTED_PROXY_CIDRS=["172.30.0.10/32"])
    def test_ip_allowlist_accepts_overwritten_header_only_from_gateway(self):
        middleware = IPAllowlistMiddleware(get_response=lambda request: None)
        trusted = self.factory.get(
            "/api/v1/monitoring-targets/",
            HTTP_X_FORWARDED_FOR="203.0.113.9",
            REMOTE_ADDR="172.30.0.10",
        )
        self.assertEqual(middleware._get_client_ip(trusted), "203.0.113.9")

        chained = self.factory.get(
            "/api/v1/monitoring-targets/",
            HTTP_X_FORWARDED_FOR="203.0.113.9, 8.8.8.8",
            REMOTE_ADDR="172.30.0.10",
        )
        self.assertEqual(middleware._get_client_ip(chained), "172.30.0.10")

    def test_api_token_secret_is_revealed_only_on_create(self):
        self.client.force_authenticate(self.user)
        created = self.client.post(
            "/api/v1/auth/api-tokens/",
            {"name": "Deploy", "scope": "read"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        raw_token = created.data["data"]["raw_token"]
        self.assertTrue(raw_token.startswith("snt_"))
        stored = APIToken.objects.get(id=created.data["data"]["id"])
        self.assertNotEqual(stored.token_hash, raw_token)

        listed = self.client.get("/api/v1/auth/api-tokens/")
        self.assertEqual(listed.status_code, 200)
        self.assertNotIn("raw_token", listed.data["data"][0])
        self.assertNotIn("token", listed.data["data"][0])

    def test_revoke_sessions_preserves_current_refresh(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        from rest_framework_simplejwt.tokens import RefreshToken

        current = RefreshToken.for_user(self.user)
        other = RefreshToken.for_user(self.user)
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/v1/auth/revoke-sessions/",
            {"current_refresh_token": str(current)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        blacklisted_jtis = set(BlacklistedToken.objects.values_list("token__jti", flat=True))
        self.assertIn(other["jti"], blacklisted_jtis)
        self.assertNotIn(current["jti"], blacklisted_jtis)
