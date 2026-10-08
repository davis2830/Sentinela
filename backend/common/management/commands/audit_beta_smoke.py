"""Bounded real-broker smoke; never reuses a customer's organization."""
import os
import re
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIClient


class Command(BaseCommand):
    help = 'Smoke a real Celery report and a public HTTPS check in an existing isolated E2E fixture.'

    def add_arguments(self, parser):
        parser.add_argument('--suffix', required=True)

    def handle(self, *args, **options):
        if not settings.DEBUG or os.environ.get('SENTINEL_E2E_FIXTURE') != '1':
            raise CommandError('Local DEBUG and explicit fixture opt-in required.')
        suffix = options['suffix']
        if not re.fullmatch(r'[a-zA-Z0-9-]{3,70}', suffix):
            raise CommandError('Invalid fixture suffix.')
        from organizations.models import Organization
        from monitoring.models import MonitoringTarget
        from reports.models import Report
        from reports.tasks import generate_report_task
        org = Organization.objects.filter(slug=f'e2e-{suffix}', name=f'Sentinel E2E {suffix}', beta_managed=False).first()
        expected = {f'e2e-admin-{suffix}@example.test', f'e2e-viewer-{suffix}@example.test'}
        if not org or set(org.users.values_list('email', flat=True)) != expected:
            raise CommandError('Fixture isolation check failed. Nothing modified.')
        report = Report.objects.create(organization=org, title='Isolated broker audit', report_type='summary')
        target = MonitoringTarget.objects.create(organization=org, name='Isolated public HTTPS audit',
            endpoint='https://example.com/', target_type='https', interval=300)
        try:
            generate_report_task.delay(str(report.pk))
            client = APIClient(HTTP_HOST='localhost')
            client.force_authenticate(org.users.get(email=f'e2e-admin-{suffix}@example.test'))
            response = client.post(f'/api/v1/monitoring/{target.pk}/scan/')
            if response.status_code != 202:
                raise CommandError(f'Scan admission failed: HTTP {response.status_code}.')
            for _ in range(25):
                report.refresh_from_db()
                target.refresh_from_db()
                if report.status in ('completed', 'failed') and target.last_checked_at:
                    break
                time.sleep(1)
            if report.status != 'completed' or not target.last_checked_at or not target.checks.exists():
                raise CommandError('Worker completion was not observed within 25 seconds.')
            self.stdout.write(f'Real broker -> worker -> PostgreSQL: report={report.status}; HTTPS check persisted; state={target.last_status}.')
            self.stdout.write('A persisted failure is evidence of execution, not evidence of endpoint availability.')
        finally:
            # Only these exact fixture-owned resources; no organization-wide cleanup.
            target.delete()
            report.delete()
