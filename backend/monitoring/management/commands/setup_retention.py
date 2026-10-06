"""Deprecated compatibility wrapper for one release."""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "DEPRECATED: use purge_telemetry. Retention comes from each organization."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=None, help="Ignored; retained for compatibility.")
        parser.add_argument("--purge", action="store_true", help="Retained for compatibility.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            "setup_retention está deprecado; se usará purge_telemetry con la política de cada organización."
        ))
        call_command("purge_telemetry", dry_run=options["dry_run"])
