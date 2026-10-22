"""Controlled rotation: drain and stop a probe before invalidating its token."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException
from common.models import ScanLease
from .models import AgentProbe, AgentExecution


class RotationPending(APIException):
    status_code = 409
    default_detail = 'Detén el agente y confirma la entrega de pendientes antes de rotar el token.'


@transaction.atomic
def rotate_probe_token(organization_id, probe_id, user):
    probe = AgentProbe.objects.select_for_update().get(pk=probe_id, organization_id=organization_id)
    keys = [f'{organization_id}:monitoring.monitoringtarget:{pk}' for pk in probe.assigned_targets.values_list('id',flat=True)]
    if (probe.is_online or
        AgentExecution.objects.filter(organization_id=organization_id,probe=probe,
            accepted_at__isnull=True,expires_at__gt=timezone.now()).exists() or
        ScanLease.objects.filter(organization_id=organization_id,resource_key__in=keys,pending_until__gt=timezone.now()).exists()):
        raise RotationPending()
    raw, token_hash = AgentProbe.generate_token()
    probe.token_hash = token_hash
    probe.save(update_fields=['token_hash','updated_at'])
    from audit.services import AuditService
    AuditService.log(action='update',module='monitoring',organization_id=organization_id,
        user_id=user.pk,description=f'Token de Senti9 rotado para agente {probe.pk}.')
    return raw
