import uuid
from datetime import timedelta
from django.test import TestCase, RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from accounts.models import User, APIToken
from accounts.authentication import SentinelAPITokenAuthentication
from organizations.models import Organization, OrganizationPlanTier, OrganizationSubscriptionStatus
from organizations.services import OrganizationService
from common.middleware import IPAllowlistMiddleware


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
        token_str = "snt_0123456789abcdef01234567"
        api_token = APIToken.objects.create(
            user=self.user,
            name="CI Token",
            token=token_str,
            scope="full",
        )
        request = self.factory.get("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {token_str}")
        auth = SentinelAPITokenAuthentication()
        user, token = auth.authenticate(request)
        self.assertEqual(user, self.user)
        self.assertEqual(token, api_token)

    def test_api_token_read_only_scope_blocks_post(self):
        token_str = "snt_readonlytoken0123456789a"
        APIToken.objects.create(
            user=self.user,
            name="Read Token",
            token=token_str,
            scope="read",
        )
        request = self.factory.post("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {token_str}")
        auth = SentinelAPITokenAuthentication()
        with self.assertRaises(PermissionDenied):
            auth.authenticate(request)

    def test_api_token_expired_rejected(self):
        token_str = "snt_expiredtoken0123456789ab"
        APIToken.objects.create(
            user=self.user,
            name="Expired Token",
            token=token_str,
            scope="full",
            expires_at=timezone.now() - timedelta(days=1),
        )
        request = self.factory.get("/api/v1/monitoring-targets/", HTTP_AUTHORIZATION=f"Bearer {token_str}")
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
