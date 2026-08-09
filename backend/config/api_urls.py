from django.urls import include, path

urlpatterns = [
    # Accounts (Auth)
    path("auth/", include("accounts.urls")),

    # Organizations
    path("organizations/", include("organizations.urls")),

    # Users (includes roles and permissions)
    path("users/", include("users.urls")),

    # Monitoring
    path("monitoring-targets/", include("monitoring.urls")),
    path("monitoring/", include("monitoring.urls")),

    # SSL
    path("ssl-certificates/", include("ssl_monitor.urls")),

    # DNS
    path("dns-records/", include("dns_monitor.urls")),

    # Domain (WHOIS)
    path("domains/", include("domain.urls")),

    # API Checks
    path("api-checks/", include("api_checks.urls")),

    # Security Headers
    path("security-headers/", include("security_headers.urls")),

    # Alerts
    path("alert-rules/", include("alerts.urls")),
    path("alerts/", include("alerts.urls_alerts")),

    # Notifications
    path("notifications/", include("notifications.urls")),

    # Incidents
    path("incidents/", include("incidents.urls")),

    # Reports
    path("reports/", include("reports.urls")),

    # Audit
    path("audit-logs/", include("audit.urls")),

    # Status Page
    path("status-page/", include("status_page.urls")),
]
