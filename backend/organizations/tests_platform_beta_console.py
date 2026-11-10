"""Closed-beta console workflows against the real database, with simulated mail."""

from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.core.cache import cache
from rest_framework.test import APIClient
from accounts.models import User, BetaControl, BetaInvitation, EmailChallenge, IdentityMail, APIToken
from organizations.models import Organization
from monitoring.models import MonitoringTarget
from common.subscriptions import monitoring_allowed
from organizations.platform_access import change_access


@override_settings(
    PUBLIC_APP_URL="https://portal.example.test", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
)
class BetaConsoleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.operations = Organization.objects.create(name="Operators", slug="beta-console-operators")
        self.root = User.objects.create_user(
            "operator@beta-console.test", organization=self.operations, is_staff=True, is_superuser=True
        )
        self.org = Organization.objects.create(
            name="Beta customer",
            slug="beta-console-customer",
            beta_managed=True,
            beta_status="active",
            plan_tier="pro",
            subscription_status="trialing",
            trial_ends_at=timezone.now() + timedelta(days=4),
        )
        self.owner = User.objects.create_user(
            "owner@beta-console.test",
            password="Fixture-Password-123!",
            organization=self.org,
            is_staff=True,
            email_verified_at=timezone.now(),
        )
        self.control = BetaControl.objects.get(pk=1)
        self.control.admissions_open = True
        self.control.capacity = 50
        self.control.save()
        self.invite = BetaInvitation.objects.create(
            email=self.owner.email,
            user=self.owner,
            status="active",
            token_hash="owner-fixture",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.root)
        self.prefix = "/api/v1/platform-admin/"

    def pending(self):
        user = User.objects.create_user("pending@beta-console.test", verification_required=True)
        inv = BetaInvitation.objects.create(
            email=user.email,
            user=user,
            status="pending_verification",
            token_hash="pending-fixture",
            expires_at=timezone.now() + timedelta(days=7),
        )
        return user, inv

    def test_overview_uses_all_six_modules_and_accepts_failed_measurements_as_recorded(self):
        from ssl_monitor.models import SSLCertificate

        self.pending()
        result = self.client.get(self.prefix + "beta/overview/").data["data"]
        self.assertEqual(result["registered"], 1)
        self.assertEqual(result["verification"], 1)
        self.assertEqual(result["attention"]["unconfigured"], 1)
        cert = SSLCertificate.objects.create(organization=self.org, domain="example.com")
        result = self.client.get(self.prefix + "beta/overview/").data["data"]
        self.assertEqual(result["attention"]["unconfigured"], 0)
        self.assertEqual(result["attention"]["unmeasured"], 1)
        cert.last_scanned_at = timezone.now()
        cert.is_valid = False
        cert.save()
        result = self.client.get(self.prefix + "beta/overview/").data["data"]
        self.assertEqual(result["attention"]["unmeasured"], 0)

    def test_beta_directory_has_exact_pages_and_delivery_per_stage(self):
        user, inv = self.pending()
        challenge = EmailChallenge.objects.create(
            user=user, email=user.email, token_hash="challenge", expires_at=timezone.now() + timedelta(minutes=30)
        )
        IdentityMail.objects.create(
            recipient=user.email,
            subject="Fixture",
            encrypted_body="PRIVATE_TOKEN_BODY",
            status="failed",
            attempts=2,
            challenge=challenge,
            expires_at=challenge.expires_at,
        )
        IdentityMail.objects.create(
            recipient=user.email,
            subject="Fixture",
            encrypted_body="",
            status="sent",
            invitation=inv,
            expires_at=inv.expires_at,
        )
        BetaInvitation.objects.bulk_create(
            [
                BetaInvitation(
                    email=f"page-{i}@beta-console.test",
                    token_hash=f"page-{i}",
                    expires_at=timezone.now() + timedelta(days=1),
                )
                for i in range(28)
            ]
        )
        with CaptureQueriesContext(connection) as queries:
            first = self.client.get(self.prefix + "beta/", {"page": 1}).data["data"]
        self.assertEqual(first["total"], 30)
        self.assertEqual(len(first["invitations"]), 25)
        self.assertTrue(first["has_next"])
        self.assertLessEqual(len(queries), 6)
        filtered = self.client.get(self.prefix + "beta/", {"attention": "failed_delivery", "search": "pending"}).data[
            "data"
        ]
        row = filtered["invitations"][0]
        self.assertEqual(filtered["total"], 1)
        self.assertEqual(row["invitation_delivery"]["status"], "sent")
        self.assertEqual(row["verification_delivery"]["status"], "failed")
        self.assertNotIn("PRIVATE_TOKEN_BODY", str(filtered))
        self.assertEqual(self.client.get(self.prefix + "beta/", {"page": 2}).data["data"]["has_next"], False)

    def test_admin_verification_resend_reuses_cooldown_and_revokes_old_link(self):
        user, inv = self.pending()
        old = EmailChallenge.objects.create(
            user=user, email=user.email, token_hash="previous-link", expires_at=timezone.now() + timedelta(minutes=30)
        )
        payload = {"action": "resend_verification", "invitation_id": str(inv.pk), "reason": "Help beta participant"}
        self.assertEqual(self.client.post(self.prefix + "beta/", payload, format="json").status_code, 429)
        EmailChallenge.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(minutes=2))
        with patch("accounts.beta.queue_mail") as queued:
            response = self.client.post(self.prefix + "beta/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        queued.assert_called_once()
        old.refresh_from_db()
        self.assertIsNotNone(old.revoked_at)
        self.assertEqual(self.client.post(self.prefix + "beta/", payload, format="json").status_code, 429)

    def test_feedback_configuration_is_https_audited_and_management_link_is_private(self):
        payload = {
            "action": "configure_feedback",
            "reason": "Collect beta feedback",
            "feedback_submission_url": "https://forms.example.test/intake",
            "feedback_management_url": "https://forms.example.test/private-responses",
        }
        self.assertEqual(
            self.client.post(
                self.prefix + "beta/", {**payload, "feedback_submission_url": "javascript:alert(1)"}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(self.client.post(self.prefix + "beta/", payload, format="json").status_code, 200)
        from audit.models import AuditLog

        self.assertTrue(AuditLog.objects.filter(module="beta", description__contains="Collect beta feedback").exists())
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/v1/organizations/current/beta-feedback/")
        self.assertEqual(response.data["data"]["submission_url"], payload["feedback_submission_url"])
        self.assertNotIn("private-responses", str(response.data))
        self.org.beta_managed = False
        self.org.save()
        self.assertEqual(self.client.get("/api/v1/organizations/current/beta-feedback/").data["data"]["enabled"], False)

    def test_access_preserves_subscription_invalidates_sessions_and_keeps_beta_consistent(self):
        from accounts.services import AuthService
        from monitoring.tasks import run_monitoring_check

        original = (self.org.plan_tier, self.org.subscription_status, self.org.trial_ends_at)
        token = AuthService.login(self.owner.email, "Fixture-Password-123!")["access_token"]
        _, api_token = APIToken.issue(user=self.owner, name="Fixture", scope="full")
        target = MonitoringTarget.objects.create(organization=self.org, name="Fixture", endpoint="https://example.com")
        change_access(organization_id=self.org.pk, actor=self.root, action="suspend", reason="Controlled suspension")
        self.org.refresh_from_db()
        self.owner.refresh_from_db()
        self.invite.refresh_from_db()
        self.assertEqual((self.org.plan_tier, self.org.subscription_status, self.org.trial_ends_at), original)
        self.assertEqual(
            (self.org.status, self.org.beta_status, self.invite.status), ("suspended", "suspended", "suspended")
        )
        self.assertFalse(monitoring_allowed(self.org))
        self.assertEqual(self.owner.session_version, 1)
        external = APIClient()
        for raw in (token, api_token):
            external.credentials(HTTP_AUTHORIZATION="Bearer " + raw)
            self.assertEqual(external.get("/api/v1/monitoring/").status_code, 401)
        with patch("monitoring.tasks._run_http_check") as check:
            run_monitoring_check.run(str(target.pk))
        check.assert_not_called()
        change_access(
            organization_id=self.org.pk, actor=self.root, action="reactivate", reason="Controlled reactivation"
        )
        self.org.refresh_from_db()
        self.assertEqual(self.org.subscription_status, original[1])
        external.credentials(HTTP_AUTHORIZATION="Bearer " + token)
        self.assertEqual(external.get("/api/v1/monitoring/").status_code, 401)

    def test_expired_trial_remains_expired_after_access_reactivation(self):
        self.org.trial_ends_at = timezone.now() - timedelta(days=1)
        self.org.save()
        change_access(organization_id=self.org.pk, actor=self.root, action="suspend", reason="Review account")
        change_access(organization_id=self.org.pk, actor=self.root, action="reactivate", reason="Review complete")
        self.org.refresh_from_db()
        self.assertFalse(monitoring_allowed(self.org))
        self.assertEqual(self.org.subscription_status, "trialing")

    def test_superadmin_organizations_are_protected(self):
        response = self.client.post(
            self.prefix + f"organizations/{self.operations.pk}/toggle-status/",
            {"action": "suspend", "reason": "Attempt to lock platform"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.operations.refresh_from_db()
        self.assertEqual(self.operations.status, "active")

    def test_contact_preview_and_resource_page_are_bounded_and_do_not_leak_secrets(self):
        MonitoringTarget.objects.bulk_create(
            [
                MonitoringTarget(
                    organization=self.org,
                    name=f"Resource {i}",
                    endpoint="https://user:PRIVATE_PASSWORD@example.com/path?api_key=PRIVATE_KEY",
                    custom_headers={"Authorization": "PRIVATE_HEADER"},
                )
                for i in range(26)
            ]
        )
        base = self.prefix + f"organizations/{self.org.pk}/"
        result = self.client.get(base + "resources/", {"module": "monitoring", "page": 1}).data["data"]
        self.assertEqual((result["total"], len(result["items"]), result["has_next"]), (26, 25, True))
        self.assertNotIn("PRIVATE", str(result))
        self.assertEqual(self.client.get(base + "resources/", {"module": "foreign"}).status_code, 400)
        preview = self.client.post(base + "plan-preview/", {"plan_tier": "free"}, format="json").data["data"]
        self.assertTrue(
            next(row for row in preview["consumption"] if row["key"] == "max_monitoring_targets")["exceeds"]
        )
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan_tier, "pro")
        self.assertEqual(
            self.client.patch(
                base + "contact/", {"name": "Updated customer", "reason": "Correct contact"}, format="json"
            ).status_code,
            200,
        )
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.email, "owner@beta-console.test")

    def test_trial_preview_uses_server_dates_without_writing(self):
        before = self.org.trial_ends_at
        result = self.client.post(
            self.prefix + f"organizations/{self.org.pk}/trial-preview/", {"days": 3}, format="json"
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.trial_ends_at, before)
        self.assertEqual(result.data["data"]["proposed_end"], before + timedelta(days=3))

    def test_user_detail_identifies_custom_permissions_and_never_exposes_credentials(self):
        self.owner.is_staff = False
        self.owner.authorization_mode = "custom"
        self.owner.save()
        result = self.client.get(self.prefix + f"users/{self.owner.pk}/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["data"]["authorization_mode"], "custom")
        self.assertEqual(result.data["data"]["effective_permissions"], [])
        self.assertNotIn("password", result.data["data"])

    def test_queue_counts_include_priority_buckets_without_consuming(self):
        from accounts.platform_health import queue_sizes, QUEUES

        fake = MagicMock()
        pipe = fake.pipeline.return_value
        pipe.execute.return_value = [1, 2, 3, 4] * len(QUEUES)
        with patch("redis.Redis.from_url", return_value=fake):
            rows = queue_sizes()
        self.assertEqual([row["ready"] for row in rows], [10] * 4)
        self.assertEqual(pipe.llen.call_count, 16)
        fake.lpop.assert_not_called()
        fake.rpop.assert_not_called()

    def test_health_is_read_only_safe_and_uses_unavailable_not_zero(self):
        payload = {
            "status": "degraded",
            "queried_at": timezone.now(),
            "environment": "development",
            "components": {"database": {"status": "unavailable", "latency_ms": None}},
            "queues": [{"name": "monitoring", "ready": None, "status": "unavailable"}],
            "scope": "Fixture",
        }
        with patch("accounts.platform_health.diagnostics", return_value=payload) as probe:
            first = self.client.get(self.prefix + "health/")
            second = self.client.get(self.prefix + "health/")
        self.assertEqual(first.status_code, 200)
        self.assertIsNone(first.data["data"]["queues"][0]["ready"])
        probe.assert_called_once()
        self.assertEqual(second.data, first.data)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.prefix + "health/").status_code, 403)

    def test_directory_access_filters_and_last_login_sort_are_server_side(self):
        change_access(organization_id=self.org.pk, actor=self.root, action="suspend", reason="Filter fixture")
        result = self.client.get(
            self.prefix + "organizations/",
            {"page": 1, "beta": "true", "access_status": "suspended", "ordering": "name"},
        ).data
        self.assertEqual(result["meta"]["total"], 1)
        self.assertEqual(result["data"][0]["id"], str(self.org.pk))
        self.owner.last_login = timezone.now()
        self.owner.save(update_fields=["last_login"])
        rows = self.client.get(self.prefix + "users/", {"ordering": "-last_login"}).data["data"]["users"]
        self.assertEqual(rows[0]["id"], self.owner.pk)

    def test_beta_and_organization_access_actions_share_the_same_transition(self):
        before = self.org.subscription_status
        response = self.client.post(
            self.prefix + "beta/",
            {"action": "suspend", "invitation_id": str(self.invite.pk), "reason": "Shared transition"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.org.refresh_from_db()
        self.invite.refresh_from_db()
        self.assertEqual(
            (self.org.status, self.org.beta_status, self.invite.status), ("suspended", "suspended", "suspended")
        )
        self.assertEqual(self.org.subscription_status, before)
        response = self.client.post(
            self.prefix + f"organizations/{self.org.pk}/toggle-status/",
            {"action": "reactivate", "reason": "Restore shared access"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.invite.refresh_from_db()
        self.assertEqual(self.invite.status, "active")

    def test_beta_catalog_matches_effective_limits_without_a_fictitious_price(self):
        from organizations.plans import plan_limits

        result = self.client.get(self.prefix + "catalog/", {"organization_id": str(self.org.pk)})
        self.assertEqual(result.status_code, 200)
        business = next(row for row in result.data["data"]["plans"] if row["id"] == "business")
        self.assertEqual(business["limits"], plan_limits("business", beta=True))
        self.assertIsNone(business["price"])

    def test_agent_resource_state_uses_heartbeat_freshness_and_no_credentials(self):
        from monitoring.models import AgentProbe

        probe = AgentProbe.objects.create(
            organization=self.org,
            name="Private agent",
            token_hash="PRIVATE_AGENT_HASH",
            status="online",
            last_heartbeat=timezone.now() - timedelta(minutes=3),
        )
        endpoint = self.prefix + f"organizations/{self.org.pk}/resources/"
        response = self.client.get(endpoint, {"module": "agents"})
        self.assertEqual(response.data["data"]["items"][0]["state"], "offline")
        self.assertNotIn("PRIVATE_AGENT_HASH", str(response.data))
        probe.last_heartbeat = timezone.now()
        probe.save(update_fields=["last_heartbeat"])
        self.assertEqual(self.client.get(endpoint, {"module": "agents"}).data["data"]["items"][0]["state"], "online")

    def test_blocked_attention_includes_disabled_accounts_before_organization_creation(self):
        user, invitation = self.pending()
        user.is_active = False
        user.save(update_fields=["is_active"])
        overview = self.client.get(self.prefix + "beta/overview/").data["data"]
        self.assertEqual(overview["attention"]["blocked"], 1)
        rows = self.client.get(self.prefix + "beta/", {"attention": "blocked"}).data["data"]["invitations"]
        self.assertEqual([str(row["id"]) for row in rows], [str(invitation.pk)])


class BetaAccessConcurrencyTests(TransactionTestCase):
    def setUp(self):
        BetaControl.objects.get_or_create(pk=1)
        BetaConsoleTests.setUp(self)

    def test_beta_and_organization_changes_lock_organization_before_invitation(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        from django.db import transaction, connections

        entered = Event()

        def coordinated_change(**kwargs):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '3s'")
                entered.set()
                return change_access(**kwargs)

        def beta_reactivation():
            try:
                client = APIClient()
                client.force_authenticate(self.root)
                return client.post(
                    self.prefix + "beta/",
                    {"action": "resume", "invitation_id": str(self.invite.pk), "reason": "Concurrent beta restore"},
                    format="json",
                )
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as pool:
            with patch("organizations.platform_access.change_access", side_effect=coordinated_change):
                with transaction.atomic():
                    Organization.objects.select_for_update().get(pk=self.org.pk)
                    result = pool.submit(beta_reactivation)
                    self.assertTrue(entered.wait(5), "Beta did not reach the shared transition")
                    change_access(
                        organization_id=self.org.pk,
                        actor=self.root,
                        action="suspend",
                        reason="Concurrent organization suspension",
                    )
                response = result.result(timeout=8)
        self.assertEqual(response.status_code, 200, response.data)
        self.org.refresh_from_db()
        self.invite.refresh_from_db()
        self.assertEqual((self.org.status, self.invite.status), ("active", "active"))
        self.assertEqual(self.org.subscription_status, "trialing")
