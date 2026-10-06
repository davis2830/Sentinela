"""Explicit test fixture, not a public registration bypass."""
import os
import re

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from organizations.models import Organization


class Command(BaseCommand):
    help = "Create isolated, uniquely named local E2E accounts. Forbidden in production."

    def add_arguments(self, parser):
        parser.add_argument("--suffix", required=True)
        parser.add_argument("--cleanup", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG or os.environ.get("SENTINEL_E2E_FIXTURE") != "1":
            raise CommandError("Requires DEBUG and explicit SENTINEL_E2E_FIXTURE=1. Never use in production.")
        suffix = options["suffix"]
        if not re.fullmatch(r"[a-zA-Z0-9-]{3,70}", suffix):
            raise CommandError("Invalid fixture suffix.")
        if options["cleanup"]:
            org = Organization.objects.filter(slug=f"e2e-{suffix}", name=f"Sentinel E2E {suffix}", beta_managed=False).first()
            expected = {f"e2e-admin-{suffix}@example.test", f"e2e-viewer-{suffix}@example.test"}
            if not org or set(org.users.values_list("email", flat=True)) != expected:
                raise CommandError("Fixture isolation check failed. Nothing deleted.")
            org.delete()
            self.stdout.write("Only the explicitly named E2E organization and its fixture resources removed; audit preserved.")
            return
        if User.objects.filter(email__in=[f"e2e-admin-{suffix}@example.test", f"e2e-viewer-{suffix}@example.test"]).exists():
            raise CommandError("Fixture already exists; choose a new suffix. No account was overwritten.")
        org = Organization.objects.create(name=f"Sentinel E2E {suffix}", slug=f"e2e-{suffix}")
        for role in ["admin", "viewer"]:
            User.objects.create_user(email=f"e2e-{role}-{suffix}@example.test",
                password=f"E2e-{role.title()}-Password-123!", organization=org, is_staff=role == "admin",
                verification_required=True, email_verified_at=timezone.now())
        self.stdout.write("Isolated E2E fixture created. No real email or existing account was changed.")
