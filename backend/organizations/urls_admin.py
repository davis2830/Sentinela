from django.urls import path
from accounts.platform_health import PlatformHealthView
from accounts.beta_views import BetaOverviewView
from .platform_views import ContactView, ResourcesView, PlanPreviewView, TrialPreviewView
from audit.views import PlatformAuditLogListView, PlatformAuditOptionsView, PlatformAuditDetailView
from accounts.beta_views import BetaAdminView
from accounts.platform_auth import PlatformLoginView, PlatformLogoutView, PlatformVerifyView
from .platform_users import PlatformUserActionView, PlatformUserListView, PlatformUserDetailView
from .views_admin import (
    PlatformStatsView,
    PlatformCatalogView,
    PlatformClassificationView,
    PlatformOrganizationListView,
    PlatformOrganizationDetailView,
    PlatformOrganizationExtendTrialView,
    PlatformOrganizationSetPlanView,
    PlatformOrganizationToggleStatusView,
    PlatformExportCSVView,
)

urlpatterns = [
    path("organizations/<uuid:org_id>/trial-preview/", TrialPreviewView.as_view()),
    path("health/", PlatformHealthView.as_view()),
    path("beta/overview/", BetaOverviewView.as_view()),
    path("organizations/<uuid:org_id>/contact/", ContactView.as_view()),
    path("organizations/<uuid:org_id>/resources/", ResourcesView.as_view()),
    path("organizations/<uuid:org_id>/plan-preview/", PlanPreviewView.as_view()),
    path('audit-options/', PlatformAuditOptionsView.as_view()),
    path('audit-logs/<uuid:log_id>/', PlatformAuditDetailView.as_view()),
    path('catalog/', PlatformCatalogView.as_view()),
    path('organizations/<uuid:org_id>/classification/', PlatformClassificationView.as_view()),
    path("session/login/", PlatformLoginView.as_view(), name="platform-login"),
    path("session/verify/", PlatformVerifyView.as_view(), name="platform-verify"),
    path("session/logout/", PlatformLogoutView.as_view(), name="platform-logout"),
    path("beta/", BetaAdminView.as_view(), name="platform-beta"),
    path("users/", PlatformUserListView.as_view(), name="platform-users"),
    path("users/<uuid:user_id>/", PlatformUserDetailView.as_view(), name="platform-user-detail"),
    path("users/<uuid:user_id>/action/", PlatformUserActionView.as_view(), name="platform-user-action"),
    path('audit-logs/', PlatformAuditLogListView.as_view(), name='platform-audit-logs'),
    path("stats/", PlatformStatsView.as_view(), name="platform-stats"),
    path("organizations/", PlatformOrganizationListView.as_view(), name="platform-orgs-list"),
    path("organizations/<uuid:org_id>/", PlatformOrganizationDetailView.as_view(), name="platform-org-detail"),
    path("organizations/<uuid:org_id>/extend-trial/", PlatformOrganizationExtendTrialView.as_view(), name="platform-org-extend-trial"),
    path("organizations/<uuid:org_id>/set-plan/", PlatformOrganizationSetPlanView.as_view(), name="platform-org-set-plan"),
    path("organizations/<uuid:org_id>/toggle-status/", PlatformOrganizationToggleStatusView.as_view(), name="platform-org-toggle-status"),
    path("export-csv/", PlatformExportCSVView.as_view(), name="platform-export-csv"),
]
