"""Seat admission and effective-administrator invariant, under the tenant lock."""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from accounts.models import User
from organizations.models import Organization, InvitationToken


class LastAdminRequired(ValueError):
    code = 'LAST_ADMIN_REQUIRED'


def check_member_capacity(org, invitation=None, replace_email=None):
    from organizations.services import QuotaExceededException
    pending = InvitationToken.objects.filter(organization=org, is_used=False, expires_at__gt=timezone.now())
    if invitation is not None:
        pending = pending.exclude(pk=invitation.pk)
    if replace_email:
        pending = pending.exclude(email__iexact=replace_email)
    current = User.objects.filter(organization=org).count() + pending.count()
    limit = org.get_plan_limits()['max_team_members']
    if limit < 9999 and current >= limit:
        raise QuotaExceededException('Tu plan no permite más integrantes. Consulta Planes.',
            'team_members', current, limit, org.plan_tier)


@transaction.atomic
def guard_admin_removal(organization_id, removed_ids):
    Organization.objects.select_for_update().get(pk=organization_id)
    removed = User.objects.filter(organization_id=organization_id, id__in=removed_ids, is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True))
    if not removed.exists():
        return
    remaining = User.objects.filter(organization_id=organization_id, is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True)).exclude(id__in=removed_ids)
    for user in remaining:
        if user.email_verified_at or (not user.verification_required and not settings.ENFORCE_LEGACY_EMAIL_VERIFICATION):
            return
    raise LastAdminRequired('La organización debe conservar al menos un administrador activo con acceso confirmado.')
