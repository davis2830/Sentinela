from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    AssignRoleSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)
from .services import PermissionService, RoleService, UserService


class UserListView(APIView):
    """Endpoint for listing and creating users.

    GET /api/v1/users/
    POST /api/v1/users/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        users = UserService.list_users(org_id)
        serializer = UserListSerializer(users, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = UserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = UserService.create_user(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
                organization_id=org_id,
                first_name=serializer.validated_data.get("first_name", ""),
                last_name=serializer.validated_data.get("last_name", ""),
                role=serializer.validated_data.get("role", "member"),
                is_active=serializer.validated_data.get("is_active", True),
            )
            from audit.services import AuditService
            AuditService.log(
                action="create",
                module="users",
                organization_id=org_id,
                user_id=request.user.id,
                user_email=request.user.email,
                description=f"El usuario {request.user.email} creó la cuenta {user.email}.",
            )
            response_serializer = UserListSerializer(user)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class UserDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a user.

    GET /api/v1/users/{id}/
    PATCH /api/v1/users/{id}/
    DELETE /api/v1/users/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, user_id):
        org_id = request.user.organization_id
        try:
            user = UserService.get_user(user_id, org_id)
            serializer = UserListSerializer(user)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "User not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, user_id):
        org_id = request.user.organization_id
        serializer = UserUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = UserService.update_user(
                user_id, org_id, **serializer.validated_data
            )
            from audit.services import AuditService
            AuditService.log(
                action="update",
                module="users",
                organization_id=org_id,
                user_id=request.user.id,
                user_email=request.user.email,
                description=f"El usuario {request.user.email} actualizó al usuario {user.email} (Estado: {'Activo' if user.is_active else 'Desactivado'}).",
            )
            response_serializer = UserListSerializer(user)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "User not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, user_id):
        org_id = request.user.organization_id
        try:
            target_user = UserService.get_user(user_id, org_id)
            target_email = target_user.email
            UserService.delete_user(user_id, org_id)
            from audit.services import AuditService
            AuditService.log(
                action="delete",
                module="users",
                organization_id=org_id,
                user_id=request.user.id,
                user_email=request.user.email,
                description=f"El usuario {request.user.email} eliminó la cuenta {target_email}.",
            )
            return success_response({"detail": "User deleted."})
        except Exception:
            return error_response(
                "User not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class UserRoleView(APIView):
    """Endpoint for assigning and removing roles from users.

    POST /api/v1/users/{id}/roles/
    DELETE /api/v1/users/{id}/roles/{role_id}/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, user_id):
        serializer = AssignRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            UserService.assign_role(user_id, serializer.validated_data["role_id"])
            return success_response({"detail": "Role assigned."})
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, user_id, role_id):
        try:
            UserService.remove_role(user_id, role_id)
            return success_response({"detail": "Role removed."})
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class RoleListView(APIView):
    """Endpoint for listing and creating roles.

    GET /api/v1/roles/
    POST /api/v1/roles/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        roles = RoleService.list_roles(org_id)
        serializer = RoleSerializer(roles, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = RoleSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            role = RoleService.create_role(
                name=serializer.validated_data["name"],
                organization_id=org_id,
                permission_codes=serializer.validated_data.get("permission_codes"),
            )
            response_serializer = RoleSerializer(role)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class RoleDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a role.

    GET /api/v1/roles/{id}/
    PATCH /api/v1/roles/{id}/
    DELETE /api/v1/roles/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, role_id):
        org_id = request.user.organization_id
        try:
            role = RoleService.get_role(role_id, org_id)
            serializer = RoleSerializer(role)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Role not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, role_id):
        org_id = request.user.organization_id
        serializer = RoleSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            role = RoleService.update_role(
                role_id, org_id, **serializer.validated_data
            )
            response_serializer = RoleSerializer(role)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Role not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, role_id):
        org_id = request.user.organization_id
        try:
            RoleService.delete_role(role_id, org_id)
            return success_response({"detail": "Role deleted."})
        except Exception:
            return error_response(
                "Role not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class PermissionListView(APIView):
    """Endpoint for listing permissions.

    GET /api/v1/permissions/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        permissions = PermissionService.list_permissions()
        serializer = PermissionSerializer(permissions, many=True)
        return success_response(serializer.data)