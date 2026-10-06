from django.core.management.base import BaseCommand
from django.db import transaction

from api_checks.models import APICheckTarget
from audit.services import AuditService
from common.security import SSRFSecurityException, validate_safe_public_url, validate_safe_target_endpoint
from monitoring.models import MonitoringTarget


class Command(BaseCommand):
    help = "Detect unsafe cloud targets; use --apply to disable and audit them."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist quarantine changes.")
        parser.add_argument("--operator", default="system", help="Operator recorded in audit metadata.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        operator = options["operator"]
        findings = []

        for target in APICheckTarget.objects.filter(enabled=True).select_related("organization"):
            reason = self._unsafe_reason(target.url, is_url=True)
            if reason:
                findings.append(("api_check", target, reason))

        for target in MonitoringTarget.objects.filter(enabled=True, runner_type="cloud").select_related("organization"):
            is_url = target.target_type in ("http", "https", "api")
            reason = self._unsafe_reason(target.endpoint, is_url=is_url)
            if reason:
                findings.append(("monitoring", target, reason))

        if apply_changes:
            with transaction.atomic():
                for resource_type, resource, reason in findings:
                    resource.enabled = False
                    resource.save(update_fields=["enabled", "updated_at"])
                    AuditService.log(
                        action="config_change",
                        module=resource_type,
                        organization_id=resource.organization_id,
                        user_email=operator,
                        description=f"Objetivo inseguro puesto en cuarentena: {resource.name}.",
                        metadata={
                            "resource_id": str(resource.id),
                            "resource_type": resource_type,
                            "reason": reason,
                            "operator": operator,
                            "remediation": (
                                "Recrear como target API de Monitoring asignado a un Guardián Sentinine."
                                if resource_type == "api_check"
                                else "Asignar a un Guardián Sentinine antes de reactivar."
                            ),
                        },
                    )

        mode = "APPLY" if apply_changes else "DRY-RUN"
        for resource_type, resource, reason in findings:
            self.stdout.write(
                f"[{mode}] org={resource.organization_id} type={resource_type} "
                f"id={resource.id} name={resource.name!r} reason={reason}"
            )
        self.stdout.write(
            self.style.SUCCESS(f"[{mode}] {len(findings)} objetivo(s) inseguro(s) detectado(s).")
        )
        if not apply_changes:
            self.stdout.write("No se modificaron datos. Revisa el resultado y ejecuta con --apply --operator <email>.")

    @staticmethod
    def _unsafe_reason(endpoint, *, is_url):
        try:
            if is_url:
                url = endpoint if endpoint.startswith(("http://", "https://")) else f"https://{endpoint}"
                validate_safe_public_url(url)
            else:
                validate_safe_target_endpoint(f"http://{endpoint}", allow_private=False)
        except (SSRFSecurityException, Exception) as exc:
            return str(exc)
        return ""
