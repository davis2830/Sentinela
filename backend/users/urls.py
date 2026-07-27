from django.urls import path

from .views import (
    PermissionListView,
    RoleDetailView,
    RoleListView,
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
    # Roles
    path("roles/", RoleListView.as_view(), name="role_list"),
    path("roles/<uuid:role_id>/", RoleDetailView.as_view(), name="role_detail"),
    # Permissions
    path("permissions/", PermissionListView.as_view(), name="permission_list"),
]