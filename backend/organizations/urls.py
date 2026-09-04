from django.urls import path

from .views import (
    AcceptInvitationView,
    OrganizationDetailView,
    OrganizationListView,
    OrganizationMemberBulkActionView,
    OrganizationMemberDetailView,
    OrganizationMemberExportCSVView,
    OrganizationMemberResendInviteView,
    OrganizationMembersView,
    ValidateInvitationView,
)

urlpatterns = [
    path("", OrganizationListView.as_view(), name="organization_list"),
    path("members/", OrganizationMembersView.as_view(), name="organization_members"),
    path("members/bulk-action/", OrganizationMemberBulkActionView.as_view(), name="organization_member_bulk_action"),
    path("members/export-csv/", OrganizationMemberExportCSVView.as_view(), name="organization_member_export_csv"),
    path("members/<uuid:user_id>/", OrganizationMemberDetailView.as_view(), name="organization_member_detail"),
    path("members/<uuid:user_id>/resend/", OrganizationMemberResendInviteView.as_view(), name="organization_member_resend"),
    path("invitations/validate/", ValidateInvitationView.as_view(), name="invitation_validate"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="invitation_accept"),
    path("<uuid:organization_id>/", OrganizationDetailView.as_view(), name="organization_detail"),
]