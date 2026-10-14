from django.conf import settings


def retention_policy(org):
    configured = max(int(org.metrics_retention_days or 90), 1)
    contractual = int(org.get_plan_limits()['metrics_retention_days'])
    capped = min(configured, contractual)
    enabled = settings.RETENTION_PLAN_CAP_ENFORCED
    return {'configured_days': configured, 'contractual_days': contractual,
            'applied_days': capped if enabled else configured, 'planned_days': capped,
            'cap_enforced': enabled, 'review_required': not enabled and configured > contractual}
