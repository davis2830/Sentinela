from django.urls import path

from .views import (
    OrganizationDetailView,
    OrganizationListView,
    OrganizationMembersView,
    OrganizationMemberDetailView,
)

urlpatterns = [
    path("", OrganizationListView.as_view(), name="organization_list"),
    path("members/", OrganizationMembersView.as_view(), name="organization_members"),
    path("members/<uuid:user_id>/", OrganizationMemberDetailView.as_view(), name="organization_member_detail"),
    path("<uuid:organization_id>/", OrganizationDetailView.as_view(), name="organization_detail"),
]