"""Serialize beta resource creation so concurrent requests cannot overshoot quotas."""
from functools import wraps
from django.db import transaction


def beta_creation(resource_type):
    def decorate(function):
        @wraps(function)
        @transaction.atomic
        def wrapped(*args, **kwargs):
            from organizations.models import Organization
            from organizations.services import QuotaService
            organization_id = kwargs.get("organization_id") or args[0]
            org = Organization.objects.select_for_update().get(pk=organization_id)
            if org.beta_managed:
                QuotaService.check_quota(org, resource_type)
            return function(*args, **kwargs)
        return wrapped
    return decorate
