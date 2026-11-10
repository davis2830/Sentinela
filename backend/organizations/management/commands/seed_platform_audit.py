"""Fixtures exclusively for the isolated superadmin audit database."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction
from uuid import uuid4
from accounts.models import User, BetaControl, BetaInvitation, EmailChallenge, IdentityMail
from common.crypto import encrypt_string
from organizations.models import Organization
from audit.models import AuditLog


class Command(BaseCommand):
    @transaction.atomic
    def handle(self, *args, **options):
        if (
            settings.DATABASES["default"]["NAME"] != "sentinel_audit"
            or settings.EMAIL_BACKEND != "django.core.mail.backends.locmem.EmailBackend"
        ):
            raise CommandError("Requires isolated sentinel_audit database and locmem mail.")
        org, _ = Organization.objects.get_or_create(
            slug="audit-customer",
            defaults={"name": "Audit Customer", "plan_tier": "pro", "subscription_status": "active"},
        )
        operations, _ = Organization.objects.get_or_create(
            slug="audit-operators", defaults={"name": "Audit Operators", "is_test": True}
        )
        org.status = "active"
        org.plan_tier = "pro"
        org.subscription_status = "active"
        org.is_test = False
        org.save()
        for email, fields in [
            (
                "operator@example.test",
                {
                    "is_superuser": True,
                    "is_staff": True,
                    "is_2fa_enabled": True,
                    "totp_secret": encrypt_string("JBSWY3DPEHPK3PXP"),
                },
            ),
            ("admin@example.test", {"is_staff": True}),
            ("member@example.test", {}),
        ]:
            user, _ = User.objects.get_or_create(email=email, defaults={"organization": org, **fields})
            user.organization = operations if fields.get("is_superuser") else org
            user.set_password("Isolated-platform-fixture-2026")
            user.is_active = True
            for key, value in fields.items():
                setattr(user, key, value)
            if email == "member@example.test":
                user.is_staff = False
            user.email_verified_at = timezone.now()
            user.save()
        for n in range(28):
            Organization.objects.get_or_create(
                slug=f"audit-page-{n}", defaults={"name": f"Audit pagination {n}", "is_test": True}
            )
        for suffix in ["orgs", "users", "beta", "followup"]:
            operator, _ = User.objects.get_or_create(
                email=f"operator-{suffix}@example.test", defaults={"organization": org}
            )
            operator.organization = operations
            operator.is_superuser = True
            operator.is_staff = True
            operator.is_2fa_enabled = True
            operator.totp_secret = encrypt_string("JBSWY3DPEHPK3PXP")
            operator.email_verified_at = timezone.now()
            operator.set_password("Isolated-platform-fixture-2026")
            operator.save()
        if not AuditLog.objects.filter(module="audit_fixture").exists():
            AuditLog.objects.bulk_create(
                [
                    AuditLog(
                        organization_id=org.id,
                        user_email="member@example.test",
                        action="update",
                        module="audit_fixture",
                        description=f"Controlled event {n}",
                    )
                    for n in range(30)
                ]
            )
        control, _ = BetaControl.objects.get_or_create(pk=1)
        control.capacity = 50
        control.admissions_open = True
        control.save()
        User.objects.get(email="member@example.test")
        # Repeated audits must not reuse the daily resend budget of a previous fixture.
        # Keep the old invitation and its audit history rather than clearing rate limits.
        previous = BetaInvitation.objects.filter(email="invited@example.test").first()
        if previous:
            previous.email = f"archived-invited-{previous.pk}@example.test"
            previous.save(update_fields=["email"])
        for status in ["invited", "pending_verification", "active", "suspended"]:
            member = None
            if status in ("active", "suspended"):
                beta_org, _ = Organization.objects.get_or_create(
                    slug=f"audit-beta-{status}",
                    defaults={"name": f"Audit Beta {status}", "is_test": True, "beta_managed": True},
                )
                beta_org.beta_managed = True
                beta_org.status = status
                beta_org.beta_status = status
                beta_org.save()
                member, _ = User.objects.get_or_create(
                    email=f"beta-{status}@example.test",
                    defaults={"organization": beta_org, "email_verified_at": timezone.now()},
                )
                member.organization = beta_org
                member.save(update_fields=["organization"])
            BetaInvitation.objects.update_or_create(
                email=f"{status}@example.test",
                defaults={
                    "status": status,
                    "created_at": timezone.now(),
                    "token_hash": uuid4().hex,
                    "expires_at": timezone.now() + timezone.timedelta(days=7),
                    "user": member,
                },
            )
        from monitoring.models import MonitoringTarget
        from ssl_monitor.models import SSLCertificate
        from dns_monitor.models import DNSRecord
        from domain.models import DomainInfo
        from api_checks.models import APICheckTarget
        from security_headers.models import SecurityHeaderTarget

        for index in range(26):
            MonitoringTarget.objects.get_or_create(
                organization=org,
                name=f"Audit resource {index:02}",
                defaults={
                    "endpoint": "https://example.com/health?token=PRIVATE_FIXTURE_QUERY",
                    "enabled": False,
                    "last_checked_at": timezone.now(),
                    "last_status": "down",
                },
            )
        SSLCertificate.objects.get_or_create(
            organization=org, domain="example.com", defaults={"last_scanned_at": timezone.now(), "is_valid": False}
        )
        DNSRecord.objects.get_or_create(
            organization=org, domain="example.com", record_type="A", defaults={"last_scanned_at": timezone.now()}
        )
        DomainInfo.objects.get_or_create(
            organization=org, domain="example.com", defaults={"last_scanned_at": timezone.now()}
        )
        APICheckTarget.objects.get_or_create(
            organization=org,
            name="Audit API",
            url="https://example.com/api?secret=PRIVATE_FIXTURE_QUERY",
            defaults={"enabled": False, "last_checked_at": timezone.now(), "last_status": "fail"},
        )
        SecurityHeaderTarget.objects.get_or_create(
            organization=org,
            name="Audit headers",
            url="https://example.com/",
            defaults={"enabled": False, "last_checked_at": timezone.now(), "last_grade": "F"},
        )
        pending = BetaInvitation.objects.get(email="pending_verification@example.test")
        participant, _ = User.objects.get_or_create(email="pending_verification@example.test")
        participant.verification_required = True
        participant.email_verified_at = None
        participant.is_active = True
        participant.organization = None
        participant.save()
        pending.user = participant
        pending.save(update_fields=["user"])
        challenge = EmailChallenge.objects.create(
            user=participant,
            email=participant.email,
            token_hash=uuid4().hex,
            expires_at=timezone.now() + timezone.timedelta(minutes=30),
        )
        EmailChallenge.objects.filter(pk=challenge.pk).update(created_at=timezone.now() - timezone.timedelta(minutes=2))
        IdentityMail.objects.create(
            recipient=participant.email,
            subject="Isolated failed verification",
            encrypted_body="",
            status="failed",
            attempts=1,
            challenge=challenge,
            expires_at=challenge.expires_at,
        )
        self.stdout.write("Isolated platform fixtures ready; no external messages sent.")
