"""Explicitly isolated fixture identities; never accepts a real tenant identifier."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from organizations.models import Organization
from users.authorization import validate_codes
from users.models import Role, UserRole


class Command(BaseCommand):
    help = "Prepare disposable portal quality fixtures (isolated audit DB only)."

    @transaction.atomic
    def handle(self, **options):
        if (
            settings.DATABASES["default"]["NAME"] != "sentinel_audit"
            or settings.EMAIL_BACKEND != "django.core.mail.backends.locmem.EmailBackend"
        ):
            raise CommandError("Requires isolated sentinel_audit database and locmem mail.")
        org, _ = Organization.objects.get_or_create(
            slug="quality-portal", defaults={"name": "Quality Portal Fixture", "is_test": True, "plan_tier": "pro"}
        )
        role, _ = Role.objects.get_or_create(organization=org, name="Quality Monitoring Reader")
        role.permissions.set(validate_codes(["monitoring.read"]))
        for index in range(31):
            email = "quality.admin@sentinel.invalid" if index == 0 else f"quality.member{index:02}@sentinel.invalid"
            user, _ = User.objects.get_or_create(email=email, defaults={"organization": org})
            user.set_password("Quality-Portal-Fixture-123!")
            user.is_staff = index == 0
            user.is_active = True
            user.email_verified_at = timezone.now()
            user.authorization_mode = "custom" if index == 1 else "legacy"
            user.save()
            if index == 1:
                UserRole.objects.get_or_create(user=user, role=role)
        self.stdout.write("Isolated quality fixtures prepared; no mail delivered.")
