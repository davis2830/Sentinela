"""Administrative lifecycle without losing execution receipts or silently moving monitors."""

import uuid
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit.services import AuditService
from .models import AgentProbe, AgentExecution


def active_binding(probe_id, organization_id):
    probe = (
        AgentProbe.objects.select_for_update()
        .filter(pk=probe_id, organization_id=organization_id, revoked_at__isnull=True)
        .first()
    )
    if probe is None:
        raise ValidationError({"agent_probe": "Selecciona un agente activo de tu organización."})
    return probe


def impact(probe):
    return {
        "assigned": probe.assigned_targets.count(),
        "to_pause": probe.assigned_targets.filter(enabled=True).count(),
        "pending": AgentExecution.objects.filter(
            probe=probe, organization_id=probe.organization_id, accepted_at__isnull=True, expires_at__gt=timezone.now()
        ).count(),
    }


@transaction.atomic
def revoke(probe_id, organization_id, reason, user=None):
    if not isinstance(reason, str) or not 3 <= len(reason.strip()) <= 500:
        raise ValidationError({"reason": "Indica un motivo de 3 a 500 caracteres."})
    probe = AgentProbe.objects.select_for_update().get(pk=probe_id, organization_id=organization_id)
    if probe.revoked_at:
        return probe
    before = impact(probe)
    probe.assigned_targets.filter(enabled=True).update(enabled=False)
    probe.revoked_at = timezone.now()
    probe.revocation_reason = reason.strip()
    # Invalid even for older authentication implementations; no usable replacement secret.
    probe.token_hash = "revoked:" + uuid.uuid4().hex
    probe.status = "offline"
    probe.save(update_fields=["revoked_at", "revocation_reason", "token_hash", "status", "updated_at"])
    AuditService.log(
        action="delete",
        module="monitoring",
        organization_id=organization_id,
        user_id=getattr(user, "pk", None),
        description=f"Senti9 {probe.pk} revocado; {before['to_pause']} monitores pausados. Motivo: {reason.strip()}",
    )
    return probe
