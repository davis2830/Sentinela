from django.urls import path

from .views import (
    OrganizationDetailView,
    OrganizationListView,
    OrganizationMembersView,
    OrganizationMemberDetailView,
    ValidateInvitationView,
    AcceptInvitationView,
)

urlpatterns = [
    path("", OrganizationListView.as_view(), name="organization_list"),
    path("members/", OrganizationMembersView.as_view(), name="organization_members"),
    path("members/<uuid:user_id>/", OrganizationMemberDetailView.as_view(), name="organization_member_detail"),
    path("invitations/validate/", ValidateInvitationView.as_view(), name="invitation_validate"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="invitation_accept"),
    path("<uuid:organization_id>/", OrganizationDetailView.as_view(), name="organization_detail"),
]