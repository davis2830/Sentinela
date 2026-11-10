"""One transactional access transition for platform and beta administration."""

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import User, BetaInvitation
from audit.services import AuditService
from organizations.models import Organization
from common.subscriptions import monitoring_allowed


def access_snapshot(org):
    return {
        "access_status": org.status,
        "beta_status": org.beta_status if org.beta_managed else None,
        "subscription_status": org.subscription_status,
        "monitoring_allowed": monitoring_allowed(org),
    }


@transaction.atomic
def change_access(*, organization_id, actor, action, reason):
    org = Organization.objects.select_for_update().get(pk=organization_id)
    if not (actor.is_superuser and actor.is_active):
        raise PermissionDenied()
    if action not in ("suspend", "reactivate") or not isinstance(reason, str) or len(reason.strip()) < 3:
        raise ValidationError("Indica la acción y un motivo válido.")
    if User.objects.filter(organization=org, is_superuser=True, is_active=True).exists():
        raise ValidationError("Las organizaciones con superadmins activos están protegidas.")
    if org.status == "cancelled":
        raise ValidationError("El acceso cancelado requiere una revisión administrativa.")
    before = access_snapshot(org)
    new_status = "suspended" if action == "suspend" else "active"
    changed = org.status != new_status or (org.beta_managed and org.beta_status != new_status)
    org.status = new_status
    if org.beta_managed:
        org.beta_status = new_status
    org.save(update_fields=["status", "beta_status", "updated_at"])
    if org.beta_managed:
        BetaInvitation.objects.filter(user__organization=org, status__in=["active", "suspended"]).update(
            status=new_status
        )
    if changed:
        User.objects.filter(organization=org).update(session_version=F("session_version") + 1)
    after = access_snapshot(org)
    AuditService.log(
        action="update",
        module="organization",
        organization_id=org.pk,
        user_id=actor.pk,
        user_email=actor.email,
        description=("Acceso suspendido" if action == "suspend" else "Acceso reactivado")
        + ". Motivo: "
        + reason.strip(),
        metadata={"reason": reason.strip(), "before": before, "after": after},
    )
    return {
        "message": "Acceso actualizado. Se requiere iniciar sesión de nuevo."
        if changed
        else "El acceso ya tenía ese estado.",
        **after,
    }
