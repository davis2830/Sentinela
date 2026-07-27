from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAuthenticated(BasePermission):
    """Allows access only to authenticated users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsOrganizationMember(BasePermission):
    """Ensures the user belongs to an organization.

    All data access in Sentinel is scoped to the user's organization.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "organization_id")
            and request.user.organization_id is not None
        )


class IsAdminOrReadOnly(BasePermission):
    """Allows admin users full access, others read-only."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_staff