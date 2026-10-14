from django.urls import path
from audit.views import PlatformAuditLogListView
from .views_admin import (
    PlatformStatsView,
    PlatformOrganizationListView,
    PlatformOrganizationDetailView,
    PlatformOrganizationExtendTrialView,
    PlatformOrganizationSetPlanView,
    PlatformOrganizationToggleStatusView,
    PlatformExportCSVView,
)

urlpatterns = [
    path('audit-logs/', PlatformAuditLogListView.as_view(), name='platform-audit-logs'),
    path("stats/", PlatformStatsView.as_view(), name="platform-stats"),
    path("organizations/", PlatformOrganizationListView.as_view(), name="platform-orgs-list"),
    path("organizations/<uuid:org_id>/", PlatformOrganizationDetailView.as_view(), name="platform-org-detail"),
    path("organizations/<uuid:org_id>/extend-trial/", PlatformOrganizationExtendTrialView.as_view(), name="platform-org-extend-trial"),
    path("organizations/<uuid:org_id>/set-plan/", PlatformOrganizationSetPlanView.as_view(), name="platform-org-set-plan"),
    path("organizations/<uuid:org_id>/toggle-status/", PlatformOrganizationToggleStatusView.as_view(), name="platform-org-toggle-status"),
    path("export-csv/", PlatformExportCSVView.as_view(), name="platform-export-csv"),
]
