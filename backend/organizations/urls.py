from django.urls import path

from .views import (
    AcceptInvitationView,
    OrganizationChangePlanView,
    OrganizationCurrentView,
    OrganizationDetailView,
    OrganizationExportBackupView,
    OrganizationInvoicesView,
    OrganizationListView,
    OrganizationMemberBulkActionView,
    OrganizationMemberDetailView,
    OrganizationMemberExportCSVView,
    OrganizationMemberResendInviteView,
    OrganizationMembersView,
    OrganizationSubscriptionView,
    ValidateInvitationView,
)

from .catalog_views import PlanCatalogView
from .platform_views import BetaFeedbackView

urlpatterns = [
    path("current/beta-feedback/", BetaFeedbackView.as_view(), name="organization_beta_feedback"),
    path("current/plans/", PlanCatalogView.as_view(), name="organization_plan_catalog"),
    path("", OrganizationListView.as_view(), name="organization_list"),
    path("current/", OrganizationCurrentView.as_view(), name="organization_current"),
    path("current/subscription/", OrganizationSubscriptionView.as_view(), name="organization_subscription"),
    path("current/invoices/", OrganizationInvoicesView.as_view(), name="organization_invoices"),
    path("current/change-plan/", OrganizationChangePlanView.as_view(), name="organization_change_plan"),
    path("current/export/", OrganizationExportBackupView.as_view(), name="organization_export_backup"),
    path("members/", OrganizationMembersView.as_view(), name="organization_members"),
    path("members/bulk-action/", OrganizationMemberBulkActionView.as_view(), name="organization_member_bulk_action"),
    path("members/export-csv/", OrganizationMemberExportCSVView.as_view(), name="organization_member_export_csv"),
    path("members/<uuid:user_id>/", OrganizationMemberDetailView.as_view(), name="organization_member_detail"),
    path("members/<uuid:user_id>/resend/", OrganizationMemberResendInviteView.as_view(), name="organization_member_resend"),
    path("invitations/validate/", ValidateInvitationView.as_view(), name="invitation_validate"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="invitation_accept"),
    path("<uuid:organization_id>/", OrganizationDetailView.as_view(), name="organization_detail"),
]
