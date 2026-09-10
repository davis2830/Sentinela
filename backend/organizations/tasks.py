import logging
from celery import shared_task
from django.utils import timezone

from .models import Organization, OrganizationSubscriptionStatus
from audit.services import AuditService

logger = logging.getLogger(__name__)


@shared_task(name="organizations.check_expired_trials")
def check_expired_trials():
    """Evaluate trialing organizations and transition expired trials to past_due status.

    When an organization's 14-day trial concludes without converting to a paid plan,
    its status is automatically transitioned to 'past_due', pausing background
    monitoring checks until upgraded or reactivated by a superadmin.
    """
    now = timezone.now()
    expired_orgs = Organization.objects.filter(
        subscription_status=OrganizationSubscriptionStatus.TRIALING,
        trial_ends_at__lt=now,
    )

    count = 0
    for org in expired_orgs:
        old_status = org.subscription_status
        org.subscription_status = OrganizationSubscriptionStatus.PAST_DUE
        org.save(update_fields=["subscription_status", "updated_at"])

        AuditService.log(
            action="update",
            module="subscription",
            organization_id=org.id,
            description=(
                f"El periodo de prueba de la organización '{org.name}' ha expirado. "
                f"Estado actualizado de {old_status} a PAST_DUE. Monitoreo en segundo plano pausado."
            ),
        )
        count += 1
        logger.info(
            "Organization %s (%s) trial expired on %s. Status changed to PAST_DUE.",
            org.name,
            org.id,
            org.trial_ends_at,
        )

    return f"Processed {count} expired trials."
