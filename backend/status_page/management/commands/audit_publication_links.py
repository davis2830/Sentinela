"""Read-only check of legacy published component references."""
from django.core.management.base import BaseCommand

from monitoring.models import MonitoringTarget
from api_checks.models import APICheckTarget
from status_page.models import StatusPageConfig


class Command(BaseCommand):
    help = 'Report obsolete/foreign Status Page component references; never change publication.'

    def handle(self, *args, **options):
        pages, findings = 0, 0
        for page in StatusPageConfig.objects.all().iterator(chunk_size=100):
            pages += 1
            web = set(str(pk) for pk in MonitoringTarget.objects.filter(
                organization_id=page.organization_id).values_list('pk', flat=True))
            api = set(str(pk) for pk in APICheckTarget.objects.filter(
                organization_id=page.organization_id).values_list('pk', flat=True))
            references = page.component_settings or []
            if not references:
                references = [{'id': pk} for pk in (page.monitored_targets or [])]
            seen = set()
            for component in references:
                if not isinstance(component, dict):
                    reason = 'malformed component'
                else:
                    pk, kind = str(component.get('id')), component.get('target_type') or component.get('type')
                    valid = web if kind in ('uptime', 'monitoring') else api if kind in ('api', 'api_check') else web | api
                    reason = 'duplicate component' if pk in seen else 'obsolete or foreign reference' if pk not in valid else ''
                    seen.add(pk)
                if reason:
                    findings += 1
                    self.stdout.write(f'organization={page.organization_id} page={page.pk} reason={reason}')
        self.stdout.write(f'Pages checked={pages}; findings={findings}; changes=0.')
