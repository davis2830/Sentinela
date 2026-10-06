from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken

from accounts import beta
from accounts.authentication import SentinelAPITokenAuthentication, SentinelJWTAuthentication
from accounts.models import APIToken, AbuseBucket, BetaControl, BetaInvitation, EmailChallenge, IdentityMail, User
from accounts.services import AuthService
from accounts.tasks import deliver_identity_mail
from common.crypto import decrypt_string
from common.subscriptions import eligible_organization_ids, monitoring_allowed
from organizations.models import Organization


@override_settings(DEBUG=True, PUBLIC_APP_URL="http://localhost:3001", TURNSTILE_SECRET_KEY="",
                   EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class BetaTests(TestCase):
    def setUp(self):
        BetaControl.objects.update_or_create(pk=1, defaults={"admissions_open": True, "capacity": 20})
        self.org = Organization.objects.create(name="Existing", slug="existing")
        self.admin = User.objects.create_superuser(email="operator@example.test", password="Operator-Test-123!", organization=self.org)
        self.client = APIClient()

    def register(self, email="participant@example.test"):
        inv = beta.issue_invitation(self.admin, email, "Beta test")
        token = decrypt_string(IdentityMail.objects.get(invitation=inv).encrypted_body).split("#token=")[1].split("\n")[0]
        result = beta.register(email, "Participant-Test-123!", token)
        return User.objects.get(email=email), result

    def confirmation(self, user, deliver=True):
        challenge = EmailChallenge.objects.filter(user=user).latest("created_at")
        mail = IdentityMail.objects.get(challenge=challenge)
        token = decrypt_string(mail.encrypted_body).split("#token=")[1].split("\n")[0]
        if deliver:
            deliver_identity_mail(str(mail.pk))
        return token, challenge

    def activate(self):
        user, _ = self.register()
        token, _ = self.confirmation(user)
        beta.verify(token)
        user.refresh_from_db()
        return user

    def test_registration_provisions_neither_organization_nor_jwt(self):
        user, result = self.register()
        self.assertIsNone(user.organization_id)
        self.assertIsNone(user.email_verified_at)
        self.assertTrue(user.verification_required)
        self.assertNotIn("access_token", result)
        self.assertEqual(Organization.objects.count(), 1)
        self.assertTrue(AuthService.login(user.email, "Participant-Test-123!")["requires_email_verification"])

    def test_confirmation_creates_beta_free_once(self):
        user, _ = self.register()
        token, _ = self.confirmation(user)
        self.assertEqual(beta.verify(token)["status"], "verified")
        user.refresh_from_db()
        self.assertIsNotNone(user.email_verified_at)
        self.assertEqual(user.organization.plan_tier, "free")
        self.assertEqual(user.organization.default_scan_interval_seconds, 300)
        self.assertEqual(user.organization.metrics_retention_days, 3)
        self.assertEqual(user.organization.get_plan_limits()["max_monitoring_targets"], 3)
        self.assertIsNone(user.organization.trial_ends_at)
        with self.assertRaises(ValueError):
            beta.verify(token)
        self.assertEqual(Organization.objects.filter(beta_managed=True).count(), 1)

    def test_get_link_does_not_verify(self):
        user, _ = self.register()
        token, _ = self.confirmation(user)
        response = self.client.get("/api/v1/auth/beta/verify/", {"token": token})
        self.assertEqual(response.status_code, 405)
        user.refresh_from_db()
        self.assertIsNone(user.email_verified_at)

    def test_confirmation_api_accepts_absent_or_blank_optional_captcha(self):
        for index, extra in enumerate(({}, {"turnstile_token": ""})):
            user, _ = self.register(f"verify{index}@example.test")
            token, _ = self.confirmation(user)
            response = self.client.post("/api/v1/auth/beta/verify/", {"token": token, **extra}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["data"]["status"], "verified")
            user.refresh_from_db()
            self.assertIsNotNone(user.email_verified_at)

    @override_settings(DEBUG=False, TURNSTILE_SECRET_KEY="real-secret")
    def test_blank_captcha_does_not_bypass_resend_security(self):
        response = self.client.post("/api/v1/auth/beta/resend/",
            {"token": "limited-fixture", "turnstile_token": ""}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(IdentityMail.objects.exists())

    def test_status_reports_delivery_and_server_cooldown_without_secrets(self):
        user, result = self.register()
        self.confirmation(user)
        data = beta.verification_status(result["registration_session"])
        self.assertEqual(data["delivery_status"], "sent")
        self.assertGreater(data["retry_after_seconds"], 0)
        self.assertLessEqual(data["retry_after_seconds"], 60)
        self.assertTrue(data["challenge_expires_at"])
        self.assertNotIn("token", data)
        count = IdentityMail.objects.count()
        AuthService.login(user.email, "Participant-Test-123!")
        self.assertEqual(IdentityMail.objects.count(), count)
        EmailChallenge.objects.filter(user=user).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(beta.verification_status(result["registration_session"])["delivery_status"], "expired")
        self.assertEqual(beta.verification_status("invalid-session")["delivery_status"], "unknown")

    def test_cannot_confirm_when_email_delivery_failed(self):
        user, _ = self.register()
        token, challenge = self.confirmation(user, deliver=False)
        with patch("accounts.tasks.EmailMultiAlternatives.send", side_effect=RuntimeError("SMTP error")):
            deliver_identity_mail(str(IdentityMail.objects.get(challenge=challenge).pk))
        self.assertEqual(IdentityMail.objects.get(challenge=challenge).status, "failed")
        with self.assertRaises(ValueError):
            beta.verify(token)
        self.assertIsNone(User.objects.get(pk=user.pk).organization_id)

    def test_delivery_is_bounded_and_secret_erased(self):
        user, _ = self.register()
        mail = IdentityMail.objects.get(challenge__user=user)
        with patch("accounts.tasks.EmailMultiAlternatives.send", return_value=0):
            for _ in range(5):
                IdentityMail.objects.filter(pk=mail.pk).update(last_attempt_at=None)
                deliver_identity_mail(str(mail.pk))
        mail.refresh_from_db()
        self.assertEqual(mail.attempts, 3)
        self.assertEqual(mail.status, "failed")
        self.assertEqual(mail.encrypted_body, "")

    def test_successful_delivery_erases_secret(self):
        user, _ = self.register()
        self.confirmation(user)
        self.assertEqual(IdentityMail.objects.get(challenge__user=user).encrypted_body, "")

    def test_expired_and_revoked_challenges_cannot_activate(self):
        user, _ = self.register()
        token, challenge = self.confirmation(user)
        EmailChallenge.objects.filter(pk=challenge.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        with self.assertRaises(ValueError):
            beta.verify(token)
        EmailChallenge.objects.filter(pk=challenge.pk).update(expires_at=timezone.now() + timedelta(minutes=30), revoked_at=timezone.now())
        with self.assertRaises(ValueError):
            beta.verify(token)

    def test_invite_expiry_and_email_binding(self):
        inv = beta.issue_invitation(self.admin, "invited@example.test", "Test binding")
        token = decrypt_string(IdentityMail.objects.get(invitation=inv).encrypted_body).split("#token=")[1].split("\n")[0]
        result = beta.register("different@example.test", "Participant-Test-123!", token)
        self.assertEqual(result["status"], "pending_verification")
        self.assertFalse(User.objects.filter(email="different@example.test").exists())
        BetaInvitation.objects.filter(pk=inv.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        beta.register(inv.email, "Participant-Test-123!", token)
        self.assertFalse(User.objects.filter(email=inv.email).exists())

    def test_existing_and_unknown_signup_have_same_public_contract(self):
        a = beta.register(self.admin.email, "Participant-Test-123!", "invalid")
        b = beta.register("unknown@example.test", "Participant-Test-123!", "invalid")
        self.assertEqual(a.keys(), b.keys())
        self.assertEqual(a["message"], b["message"])
        self.assertEqual(a["status"], b["status"])

    def test_resend_cooldown_and_revocation(self):
        user, result = self.register()
        old_token, challenge = self.confirmation(user)
        with self.assertRaises(Throttled):
            beta.resend(result["registration_session"])
        EmailChallenge.objects.filter(pk=challenge.pk).update(created_at=timezone.now() - timedelta(minutes=2))
        beta.resend(result["registration_session"])
        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.revoked_at)
        with self.assertRaises(ValueError):
            beta.verify(old_token)

    def test_daily_limit_uses_shared_atomic_bucket(self):
        for _ in range(5):
            beta.consume_budget("example", "recipient", 5, 86400)
        with self.assertRaises(Throttled):
            beta.consume_budget("example", "recipient", 5, 86400)
        self.assertNotIn("recipient", AbuseBucket.objects.get().key)

    def test_invite_capacity_and_closed_admissions(self):
        BetaControl.objects.filter(pk=1).update(capacity=1)
        beta.issue_invitation(self.admin, "one@example.test", "First")
        with self.assertRaises(ValueError):
            beta.issue_invitation(self.admin, "two@example.test", "Second")
        BetaControl.objects.filter(pk=1).update(admissions_open=False)
        with self.assertRaises(ValueError):
            beta.register("unknown@example.test", "Participant-Test-123!", "invalid")
        self.assertTrue(monitoring_allowed(self.org))

    def test_disposable_policy_and_legitimate_addresses(self):
        for email in ["user@gmail.com", "student@miumg.edu.gt", "user@proton.me"]:
            beta.check_email(beta.normalize_email(email))
        for email in ["user@mailinator.com", "user@a.yopmail.com"]:
            with self.assertRaises(ValueError):
                beta.check_email(email)
        self.assertEqual(beta.normalize_email(" Person.Name+beta@EXAMPLE.COM "), "Person.Name+beta@example.com")

    @override_settings(BETA_EMAIL_DOMAIN_ALLOWLIST=["mailinator.com"])
    def test_reviewed_domain_exception(self):
        beta.check_email("user@mailinator.com")

    @override_settings(DEBUG=False, TURNSTILE_SECRET_KEY="")
    def test_production_captcha_fails_closed(self):
        with self.assertRaises(ValueError):
            beta.validate_captcha("anything", "register", "127.0.0.1")

    @override_settings(DEBUG=False, TURNSTILE_SECRET_KEY="production-secret", TURNSTILE_HOSTNAMES=["beta.example.com"])
    def test_captcha_checks_action_hostname_and_replay(self):
        with patch("common.safe_http.post") as post:
            post.return_value.json.return_value = {"success": True, "hostname": "beta.example.com", "action": "register"}
            beta.validate_captcha("single-use", "register", "127.0.0.1")
            with self.assertRaises(Throttled):
                beta.validate_captcha("single-use", "register", "127.0.0.1")
            for result in [{"success": True, "hostname": "evil.example.com", "action": "register"},
                           {"success": True, "hostname": "beta.example.com", "action": "login"},
                           {"success": False}]:
                post.return_value.json.return_value = result
                with self.assertRaises(ValueError):
                    beta.validate_captcha("other", "register", "127.0.0.1")

    def test_pending_jwt_api_token_and_refresh_are_rejected(self):
        user, _ = self.register()
        refresh = RefreshToken.for_user(user)
        with self.assertRaises(AuthenticationFailed):
            SentinelJWTAuthentication().get_user(refresh.access_token)
        with self.assertRaises(ValueError):
            AuthService.refresh_token(str(refresh))
        _, raw = APIToken.issue(user=user, name="forged")
        request = APIRequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {raw}")
        with self.assertRaises(AuthenticationFailed):
            SentinelAPITokenAuthentication().authenticate(request)

    def test_suspension_blocks_tokens_and_background_eligibility(self):
        user = self.activate()
        token = RefreshToken.for_user(user)
        Organization.objects.filter(pk=user.organization_id).update(beta_status="suspended")
        user.refresh_from_db()
        self.assertFalse(monitoring_allowed(user.organization))
        self.assertNotIn(user.organization_id, [v["id"] for v in eligible_organization_ids()])
        with self.assertRaises(AuthenticationFailed):
            SentinelJWTAuthentication().get_user(token.access_token)

    def test_login_never_assigns_first_organization(self):
        user = User.objects.create_user(email="orphan@example.test", password="Orphan-Test-123!")
        with self.assertRaises(ValueError):
            AuthService.login(user.email, "Orphan-Test-123!")
        user.refresh_from_db()
        self.assertIsNone(user.organization_id)

    def test_admin_scope_metadata_and_audit(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/v1/auth/beta/admin/", {"action": "invite", "email": "invite@example.test", "reason": "Approved participant"}, format="json")
        self.assertEqual(response.status_code, 202)
        listed = self.client.get("/api/v1/auth/beta/admin/")
        self.assertNotIn("token_hash", str(listed.data))
        self.assertNotIn("encrypted_body", str(listed.data))
        from audit.models import AuditLog
        self.assertTrue(AuditLog.objects.filter(module="beta", user_id=self.admin.pk).exists())
        self.admin.is_superuser = False
        self.admin.save()
        self.assertEqual(self.client.get("/api/v1/auth/beta/admin/").status_code, 403)

    def test_email_change_requires_password_keeps_old_until_confirmed_and_revokes(self):
        user = self.activate()
        refresh = RefreshToken.for_user(user)
        _, raw = APIToken.issue(user=user, name="previous")
        with self.assertRaises(ValueError):
            beta.change_email(user, "new@example.test", "wrong")
        beta.change_email(user, "new@example.test", "Participant-Test-123!")
        user.refresh_from_db()
        self.assertEqual(user.email, "participant@example.test")
        token, _ = self.confirmation(user)
        beta.verify(token)
        user.refresh_from_db()
        self.assertEqual(user.email, "new@example.test")
        self.assertFalse(APIToken.objects.filter(user=user).exists())
        with self.assertRaises(AuthenticationFailed):
            SentinelJWTAuthentication().get_user(refresh.access_token)
        with self.assertRaises(ValueError):
            AuthService.refresh_token(str(refresh))

    def test_email_patch_is_rejected(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch("/api/v1/auth/me/", {"email": "new@example.test"}, format="json").status_code, 400)

    def test_disabled_account_cannot_activate_with_a_valid_link(self):
        user, _ = self.register()
        token, _ = self.confirmation(user)
        User.objects.filter(pk=user.pk).update(is_active=False)
        with self.assertRaises(ValueError):
            beta.verify(token)
        self.assertFalse(Organization.objects.filter(beta_managed=True).exists())

    def test_closed_admission_does_not_stop_active_beta_users(self):
        user = self.activate()
        BetaControl.objects.filter(pk=1).update(admissions_open=False)
        self.assertTrue(monitoring_allowed(user.organization))
        self.assertIn("access_token", AuthService.login(user.email, "Participant-Test-123!"))

    def test_beta_free_notification_requires_a_verified_destination(self):
        from notifications.services import NotificationChannelService
        user = self.activate()
        with self.assertRaises(ValueError):
            NotificationChannelService.create_channel(user.organization_id, "External", "email",
                                                       {"recipients": ["outside@example.test"]})
        with self.assertRaises(ValueError):
            NotificationChannelService.create_channel(user.organization_id, "Slack", "slack", {})
        channel = NotificationChannelService.create_channel(user.organization_id, "Verified", "email",
                                                           {"recipients": [user.email]})
        self.assertIsNotNone(channel.pk)

    def test_beta_free_creation_budget_survives_deletions(self):
        user = self.activate()
        self.client.force_authenticate(user)
        data = {"name": "Monitor", "target_type": "https", "endpoint": "https://8.8.8.8", "related_modules": []}
        with patch("monitoring.tasks.register_target_in_submonitors.delay"):
            for _ in range(10):
                response = self.client.post("/api/v1/monitoring/", data, format="json")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(self.client.delete(f"/api/v1/monitoring/{response.data['data']['id']}/").status_code, 200)
            self.assertEqual(self.client.post("/api/v1/monitoring/", data, format="json").status_code, 429)

    def test_free_capacity_is_three_while_existing_free_remains_five(self):
        from organizations.services import QuotaService, QuotaExceededException
        from monitoring.models import MonitoringTarget
        user = self.activate()
        for i in range(3):
            MonitoringTarget.objects.create(organization=user.organization, name=str(i), target_type="http", endpoint="https://8.8.8.8")
        with self.assertRaises(QuotaExceededException):
            QuotaService.check_quota(user.organization, "targets")
        self.assertEqual(self.org.get_plan_limits()["max_monitoring_targets"], 5)
        self.assertIsNone(self.admin.email_verified_at)

    @override_settings(DEBUG=False, TURNSTILE_SECRET_KEY="", TURNSTILE_SITE_KEY="")
    def test_production_admin_cannot_open_without_delivery_configuration(self):
        BetaControl.objects.filter(pk=1).update(admissions_open=False)
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/v1/auth/beta/admin/", {"action": "configure", "reason": "Open beta", "admissions_open": True}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(BetaControl.objects.get(pk=1).admissions_open)

    def test_identity_purge_never_deletes_users_and_is_dry_run(self):
        from django.core.management import call_command
        user, _ = self.register()
        EmailChallenge.objects.filter(user=user).update(expires_at=timezone.now() - timedelta(days=40))
        call_command("purge_identity_artifacts")
        self.assertTrue(EmailChallenge.objects.filter(user=user).exists())
        call_command("purge_identity_artifacts", apply=True)
        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(EmailChallenge.objects.filter(user=user).exists())

    def test_versioned_disposable_policy_keeps_last_valid_update(self):
        import json
        from django.core.management import call_command
        from django.core.management.base import CommandError
        from accounts.models import DisposableDomainPolicy
        with patch("pathlib.Path.read_text", return_value=json.dumps({"version": "test-1", "domains": ["disposable.example"]})):
            call_command("update_disposable_domains", file="reviewed.json", operator=str(self.admin.pk), reason="Reviewed policy")
        with self.assertRaises(ValueError):
            beta.check_email("user@disposable.example")
        with patch("pathlib.Path.read_text", return_value=json.dumps({"version": "bad", "domains": ["https://invalid"]})):
            with self.assertRaises(CommandError):
                call_command("update_disposable_domains", file="invalid.json", operator=str(self.admin.pk), reason="Invalid update")
        self.assertEqual(DisposableDomainPolicy.objects.get(pk=1).version, "test-1")

    def test_member_created_by_admin_must_verify(self):
        from users.services import UserService
        user = UserService.create_user("new-member@example.test", "Member-Test-123!", self.org.pk)
        self.assertTrue(AuthService.login(user.email, "Member-Test-123!")["requires_email_verification"])
        token, _ = self.confirmation(user)
        beta.verify(token)
        self.assertIn("access_token", AuthService.login(user.email, "Member-Test-123!"))

    def test_member_invitation_cannot_reset_or_transfer_existing_user(self):
        from organizations.models import InvitationToken
        inv = InvitationToken.objects.create(organization=self.org, email=self.admin.email, token="existing-user-invite",
                                            expires_at=timezone.now() + timedelta(hours=24))
        response = self.client.post("/api/v1/organizations/invitations/accept/", {"token": inv.token, "password": "Attacker-Password-123!"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("Operator-Test-123!"))

    def test_first_scan_budget_survives_resource_recreation(self):
        from monitoring.models import MonitoringTarget
        from common.scan_limits import reserve, ScanLimited
        user = self.activate()
        for i in range(12):
            target = MonitoringTarget.objects.create(organization=user.organization, name=str(i), target_type="http", endpoint="https://8.8.8.8")
            reserve(target)
            target.delete()
        target = MonitoringTarget.objects.create(organization=user.organization, name="overflow", target_type="http", endpoint="https://8.8.8.8")
        with self.assertRaises(ScanLimited):
            reserve(target)

    @override_settings(BETA_MAX_PENDING_SCANS=1)
    def test_beta_global_pending_queue_is_bounded(self):
        from monitoring.models import MonitoringTarget
        from common.scan_limits import reserve, ScanLimited
        user = self.activate()
        first = MonitoringTarget.objects.create(organization=user.organization, name="First", target_type="http", endpoint="https://8.8.8.8")
        second = MonitoringTarget.objects.create(organization=user.organization, name="Second", target_type="http", endpoint="https://8.8.8.8")
        reserve(first)
        with self.assertRaises(ScanLimited):
            reserve(second)


class BetaConcurrencyTests(TransactionTestCase):
    def setUp(self):
        BetaControl.objects.update_or_create(pk=1, defaults={"admissions_open": True, "capacity": 1})

    def pending(self, suffix):
        user = User.objects.create_user(email=f"race-{suffix}@example.test", password="Race-Test-123!", verification_required=True)
        BetaInvitation.objects.create(email=user.email, token_hash=beta.digest("invite-" + suffix), user=user,
            status="pending_verification", expires_at=timezone.now() + timedelta(days=7))
        challenge = EmailChallenge.objects.create(user=user, email=user.email, token_hash=beta.digest("verify-" + suffix),
                                                  expires_at=timezone.now() + timedelta(minutes=30))
        IdentityMail.objects.create(recipient=user.email, subject="Already accepted", encrypted_body="", status="sent",
                                   expires_at=challenge.expires_at, challenge=challenge)
        return "verify-" + suffix

    def race(self, tokens):
        barrier = Barrier(2)
        def run(token):
            connections.close_all()
            try:
                barrier.wait(timeout=5)
                beta.verify(token)
                return "ok"
            except ValueError:
                return "rejected"
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as executor:
            return list(executor.map(run, tokens))

    def test_same_token_concurrent_confirmation_creates_exactly_one_org(self):
        token = self.pending("one")
        self.assertCountEqual(self.race([token, token]), ["ok", "rejected"])
        self.assertEqual(Organization.objects.count(), 1)

    def test_capacity_lock_prevents_parallel_overadmission(self):
        tokens = [self.pending("one"), self.pending("two")]
        self.assertCountEqual(self.race(tokens), ["ok", "rejected"])
        self.assertEqual(Organization.objects.count(), 1)

    def test_beta_resource_quota_is_atomic_across_requests(self):
        from monitoring.models import MonitoringTarget
        from monitoring.services import MonitoringService
        from organizations.services import QuotaExceededException
        org = Organization.objects.create(name="Beta quota", slug="beta-quota", beta_managed=True)
        for i in range(2):
            MonitoringTarget.objects.create(organization=org, name=str(i), target_type="https", endpoint="https://8.8.8.8")
        barrier = Barrier(2)
        def create(number):
            connections.close_all()
            try:
                barrier.wait(timeout=5)
                MonitoringService.create_target(org.pk, str(number), "https", "https://8.8.8.8", interval=300, related_modules=[])
                return "ok"
            except QuotaExceededException:
                return "rejected"
            finally:
                connections.close_all()
        with patch("monitoring.tasks.register_target_in_submonitors.delay"):
            with ThreadPoolExecutor(max_workers=2) as executor:
                self.assertCountEqual(list(executor.map(create, [1, 2])), ["ok", "rejected"])
        self.assertEqual(MonitoringTarget.objects.filter(organization=org).count(), 3)
