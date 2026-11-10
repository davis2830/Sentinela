"""Administrative authorization changes, serialized under the tenant lock."""

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from common.authorization import catalog, effective_permissions
from organizations.models import Organization
from users.models import Permission, Role, UserRole


def validate_codes(codes):
    allowed = {item["code"] for item in catalog()}
    if set(codes) - allowed:
        raise ValidationError({"permission_codes": "Permiso desconocido o reservado a administración."})
    for item in catalog():
        if item["code"] in codes:
            Permission.objects.get_or_create(
                code=item["code"], defaults={"name": item["name"], "module": item["module"]}
            )
    return Permission.objects.filter(code__in=codes)


def revoke(users):
    users.update(session_version=F("session_version") + 1)


def audit(actor, target, reason, before, after):
    from audit.services import AuditService

    AuditService.log(
        action="update",
        module="users",
        organization_id=target.organization_id,
        user_id=actor.pk,
        user_email=actor.email,
        description=f"Autorización de {target.email}: {reason}",
        metadata={"target_id": str(target.pk), "reason": reason, "before": before, "after": after},
    )


def snapshot(user):
    return {
        "authorization_mode": user.authorization_mode,
        "effective_permissions": effective_permissions(user),
        "role_ids": [str(pk) for pk in user.user_roles.values_list("role_id", flat=True)],
    }


@transaction.atomic
def configure(*, actor, user_id, mode, reason, role_ids=None):
    if not (actor.is_staff or actor.is_superuser):
        raise PermissionDenied()
    Organization.objects.select_for_update().get(pk=actor.organization_id)
    user = User.objects.select_for_update().get(pk=user_id, organization_id=actor.organization_id)
    if user.is_staff or user.is_superuser:
        raise ValidationError("Los administradores y superadmins conservan su autorización administrativa.")
    if mode not in ("legacy", "custom") or not isinstance(reason, str) or not reason.strip():
        raise ValidationError("Selecciona el modo de autorización e indica un motivo.")
    before = snapshot(user)
    if role_ids is not None:
        roles = list(Role.objects.filter(pk__in=role_ids, organization_id=actor.organization_id))
        if len(roles) != len(set(map(str, role_ids))):
            raise ValidationError("Uno o más roles no pertenecen a la organización.")
        UserRole.objects.filter(user=user).delete()
        UserRole.objects.bulk_create([UserRole(user=user, role=role) for role in roles])
    user.authorization_mode = mode
    user.save(update_fields=["authorization_mode", "updated_at"])
    after = snapshot(user)
    if before["effective_permissions"] != after["effective_permissions"] or before["authorization_mode"] != mode:
        revoke(User.objects.filter(pk=user.pk))
    audit(actor, user, reason.strip(), before, after)
    return after


@transaction.atomic
def assign(*, actor, user_id, role_id, remove=False, reason=""):
    Organization.objects.select_for_update().get(pk=actor.organization_id)
    user = User.objects.get(pk=user_id, organization_id=actor.organization_id)
    role = Role.objects.get(pk=role_id, organization_id=actor.organization_id)
    ids = set(user.user_roles.values_list("role_id", flat=True))
    if remove:
        ids.discard(role.pk)
    else:
        ids.add(role.pk)
    if user.authorization_mode == "legacy" and not reason:
        reason = "Asignación de roles inactivos en modo legacy."
    return configure(actor=actor, user_id=user_id, mode=user.authorization_mode, reason=reason, role_ids=list(ids))


@transaction.atomic
def change_role(*, actor, role_id, reason, fields=None, delete=False):
    if not (actor.is_staff or actor.is_superuser):
        raise PermissionDenied()
    if not reason or not reason.strip():
        raise ValidationError("Indica el motivo del cambio de rol.")
    Organization.objects.select_for_update().get(pk=actor.organization_id)
    role = Role.objects.get(pk=role_id, organization_id=actor.organization_id)
    affected = list(User.objects.filter(organization_id=actor.organization_id, user_roles__role=role))
    before = {user.pk: snapshot(user) for user in affected}
    if delete:
        role.delete()
    else:
        fields = fields or {}
        if "permission_codes" in fields:
            role.permissions.set(validate_codes(fields["permission_codes"]))
        if "name" in fields:
            role.name = fields["name"]
        role.save()
    for user in affected:
        after = snapshot(user)
        if before[user.pk]["effective_permissions"] != after["effective_permissions"]:
            revoke(User.objects.filter(pk=user.pk))
        audit(actor, user, reason.strip(), before[user.pk], after)
    from audit.services import AuditService

    AuditService.log(
        action="delete" if delete else "update",
        module="users",
        organization_id=actor.organization_id,
        user_id=actor.pk,
        user_email=actor.email,
        description=f"Rol {role.name}: {reason.strip()}",
    )
    return role
