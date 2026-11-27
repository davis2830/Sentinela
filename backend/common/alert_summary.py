"""Shared O(1)-cached alert rule and notification channel summary for connectivity serializers."""


def get_target_alert_summary(instance, target_type: str, context: dict | None = None) -> dict:
    """Return active alert rules matching `instance` and enabled notification destinations.

    Uses `context` (typically `serializer.context`) to cache rules and channels per organization
    so listing N targets stays strictly O(1) in database queries.
    """
    from alerts.models import AlertRule
    from notifications.models import NotificationChannel

    cache = context if context is not None else {}
    org_id = instance.organization_id

    rules_key = f"_alert_summary_rules_{target_type}"
    rules_cache = cache.setdefault(rules_key, {})
    if org_id not in rules_cache:
        rules_cache[org_id] = list(
            AlertRule.objects.filter(
                organization_id=org_id,
                target_type=target_type,
                enabled=True,
            ).only("id", "name", "condition", "threshold", "severity", "target_id", "snoozed_until")
        )

    channels_cache = cache.setdefault("_alert_summary_org_channels", {})
    if org_id not in channels_cache:
        channels_cache[org_id] = list(
            NotificationChannel.objects.filter(
                organization_id=org_id,
                enabled=True,
            ).only("id", "name", "channel_type")
        )

    instance_pk = str(instance.pk)
    matched_rules = [
        {
            "id": str(r.pk),
            "name": r.name,
            "condition": r.condition,
            "threshold": r.threshold,
            "severity": r.severity,
            "snoozed_until": r.snoozed_until.isoformat() if r.snoozed_until else None,
        }
        for r in rules_cache[org_id]
        if r.target_id is None or str(r.target_id) == instance_pk
    ]
    destinations = [
        {
            "id": str(ch.pk),
            "name": ch.name,
            "channel_type": ch.channel_type,
        }
        for ch in channels_cache[org_id]
    ]
    return {"rules": matched_rules, "destinations": destinations}
