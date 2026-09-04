from django.urls import path

from .views import (
    PermissionListView,
    RoleDetailView,
    RoleListView,
    TeamDetailView,
    TeamListView,
    TeamMembersView,
    TeamSeedDefaultsView,
    UserDetailView,
    UserListView,
    UserRoleView,
)

urlpatterns = [
    # Users
    path("", UserListView.as_view(), name="user_list"),
    path("<uuid:user_id>/", UserDetailView.as_view(), name="user_detail"),
    path("<uuid:user_id>/roles/", UserRoleView.as_view(), name="user_roles"),
    path(
        "<uuid:user_id>/roles/<uuid:role_id>/",
        UserRoleView.as_view(),
        name="user_role_remove",
    ),
    # Teams
    path("teams/", TeamListView.as_view(), name="team_list"),
    path("teams/seed-defaults/", TeamSeedDefaultsView.as_view(), name="team_seed_defaults"),
    path("teams/<uuid:team_id>/", TeamDetailView.as_view(), name="team_detail"),
    path("teams/<uuid:team_id>/members/", TeamMembersView.as_view(), name="team_members"),
    # Roles
    path("roles/", RoleListView.as_view(), name="role_list"),
    path("roles/<uuid:role_id>/", RoleDetailView.as_view(), name="role_detail"),
    # Permissions
    path("permissions/", PermissionListView.as_view(), name="permission_list"),
]