"""Commercial catalog and effective limits; one policy for portal and platform."""

PLAN_LIMITS = {
    "free": {
        "tier": "free",
        "name": "Starter / Free",
        "price_monthly_usd": 0,
        "max_monitoring_targets": 5,
        "max_ssl_certificates": 2,
        "max_api_checks": 1,
        "max_dns_records": 5,
        "max_domains": 2,
        "max_security_headers": 2,
        "max_notification_channels": 2,
        "max_private_agents": 0,
        "min_check_interval_seconds": 300,
        "metrics_retention_days": 7,
        "max_team_members": 1,
        "max_status_pages": 1,
        "custom_domain_status_page": False,
        "sla_reports": False,
        "maintenance_windows": False,
        "rca_postmortem": False,
    },
    "pro": {
        "tier": "pro",
        "name": "Pro / Growth",
        "price_monthly_usd": 29,
        "max_monitoring_targets": 25,
        "max_ssl_certificates": 10,
        "max_api_checks": 5,
        "max_dns_records": 25,
        "max_domains": 10,
        "max_security_headers": 10,
        "max_notification_channels": 5,
        "max_private_agents": 1,
        "min_check_interval_seconds": 60,
        "metrics_retention_days": 30,
        "max_team_members": 5,
        "max_status_pages": 2,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": False,
        "rca_postmortem": False,
    },
    "business": {
        "tier": "business",
        "name": "Business",
        "price_monthly_usd": 99,
        "max_monitoring_targets": 75,
        "max_ssl_certificates": 50,
        "max_api_checks": 25,
        "max_dns_records": 100,
        "max_domains": 50,
        "max_security_headers": 50,
        "max_notification_channels": 20,
        "max_private_agents": 3,
        "min_check_interval_seconds": 30,
        "metrics_retention_days": 90,
        "max_team_members": 15,
        "max_status_pages": 10,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": True,
        "rca_postmortem": True,
    },
    "enterprise": {
        "tier": "enterprise",
        "name": "Enterprise Dedicated",
        "price_monthly_usd": 399,
        "max_monitoring_targets": 9999,
        "max_ssl_certificates": 9999,
        "max_api_checks": 9999,
        "max_dns_records": 9999,
        "max_domains": 9999,
        "max_security_headers": 9999,
        "max_notification_channels": 9999,
        "max_private_agents": 9999,
        "min_check_interval_seconds": 15,
        "metrics_retention_days": 365,
        "max_team_members": 9999,
        "max_status_pages": 9999,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": True,
        "rca_postmortem": True,
    },
}


def plan_limits(tier, *, beta=False):
    limits = dict(PLAN_LIMITS.get(tier, PLAN_LIMITS["free"]))
    if beta and tier == "free":
        limits.update(max_monitoring_targets=3, metrics_retention_days=3)
    return limits


RESOURCE_LABELS = {
    "max_monitoring_targets": "Monitores de Uptime",
    "max_ssl_certificates": "Certificados SSL",
    "max_api_checks": "API Checks",
    "max_dns_records": "Registros DNS",
    "max_domains": "Dominios",
    "max_security_headers": "Chequeos de cabeceras",
    "max_notification_channels": "Canales de notificación",
    "max_private_agents": "Agentes privados",
    "max_team_members": "Integrantes",
    "max_status_pages": "Status Pages",
}
FEATURE_LABELS = {
    "custom_domain_status_page": "Dominio personalizado",
    "sla_reports": "Reportes SLA",
    "maintenance_windows": "Ventanas de mantenimiento",
    "rca_postmortem": "Análisis RCA",
}


def plan_catalog(*, beta=False):
    result = []
    for tier in PLAN_LIMITS:
        if beta and tier == "enterprise":
            continue
        limits = plan_limits(tier, beta=beta)
        features = [
            f"{'Sin límite' if limits[key] >= 9999 else limits[key]} {label}" for key, label in RESOURCE_LABELS.items()
        ]
        features += [
            f"Intervalo mínimo: {limits['min_check_interval_seconds']} segundos",
            f"{limits['metrics_retention_days']} días de retención",
        ]
        features += [label for key, label in FEATURE_LABELS.items() if limits[key]]
        quote = beta and tier == "business"
        result.append(
            {
                "id": tier,
                "tier": tier,
                "name": limits["name"],
                "price_monthly_usd": limits["price_monthly_usd"],
                "price": "Cotización" if quote else f"${limits['price_monthly_usd']}",
                "period": "Contacta al administrador" if quote else "USD / mes",
                "features": features,
                "notIncluded": [label for key, label in FEATURE_LABELS.items() if not limits[key]],
                "limits": limits,
                "beta": beta,
            }
        )
    return result
