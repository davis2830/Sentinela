from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api_checks.models import APICheckResult
from dns_monitor.models import DNSChangeHistory
from monitoring.models import MonitoringCheck
from organizations.models import Organization
from security_headers.models import SecurityHeaderResult


class Command(BaseCommand):
    help = "Purge historical telemetry using each organization's retention policy."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report counts without deleting rows.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        total = 0
        for organization in Organization.objects.iterator():
            days = max(int(organization.metrics_retention_days or 90), 1)
            cutoff = timezone.now() - timedelta(days=days)
            querysets = {
                "monitoring_checks": MonitoringCheck.objects.filter(target__organization=organization, checked_at__lt=cutoff),
                "api_check_results": APICheckResult.objects.filter(target__organization=organization, checked_at__lt=cutoff),
                "security_header_results": SecurityHeaderResult.objects.filter(target__organization=organization, checked_at__lt=cutoff),
                "dns_change_history": DNSChangeHistory.objects.filter(record__organization=organization, changed_at__lt=cutoff),
            }
            counts = {name: queryset.count() for name, queryset in querysets.items()}
            org_total = sum(counts.values())
            total += org_total
            if not dry_run and org_total:
                with transaction.atomic():
                    for queryset in querysets.values():
                        queryset.delete()
            self.stdout.write(
                f"org={organization.id} retention_days={days} "
                + " ".join(f"{name}={count}" for name, count in counts.items())
            )

        mode = "DRY-RUN" if dry_run else "APPLY"
        self.stdout.write(self.style.SUCCESS(f"[{mode}] {total} registro(s) histórico(s) procesado(s)."))
