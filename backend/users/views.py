from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .models import Team
from .serializers import (
    AssignRoleSerializer,
    PermissionSerializer,
    RoleSerializer,
    TeamCreateUpdateSerializer,
    TeamMembersUpdateSerializer,
    TeamSerializer,
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


class TeamListView(APIView):
    """Endpoint for listing and creating teams within an organization.

    GET /api/v1/users/teams/
    POST /api/v1/users/teams/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        teams = Team.objects.filter(organization_id=org_id).prefetch_related("members")
        serializer = TeamSerializer(teams, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = TeamCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        name = serializer.validated_data["name"].strip()
        description = serializer.validated_data.get("description", "").strip()
        color = serializer.validated_data.get("color", "#10B981")
        member_ids = serializer.validated_data.get("member_ids", [])
        lead_id = serializer.validated_data.get("lead_id")
        contact_email = serializer.validated_data.get("contact_email", "").strip()

        if Team.objects.filter(organization_id=org_id, name__iexact=name).exists():
            return error_response(
                f"Ya existe un equipo llamado '{name}' en la organización.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from accounts.models import User
        lead_user = None
        if lead_id:
            lead_user = User.objects.filter(id=lead_id, organization_id=org_id).first()

        team = Team.objects.create(
            organization_id=org_id,
            name=name,
            description=description,
            color=color,
            lead=lead_user,
            contact_email=contact_email,
        )
        if member_ids:
            members = User.objects.filter(id__in=member_ids, organization_id=org_id)
            team.members.set(members)
            if lead_user and lead_user not in members:
                team.members.add(lead_user)

        from audit.services import AuditService
        AuditService.log(
            action="create",
            module="users",
            organization_id=org_id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"El usuario {request.user.email} creó el equipo de trabajo '{team.name}'.",
        )

        response_serializer = TeamSerializer(team)
        return success_response(response_serializer.data, status_code=status.HTTP_201_CREATED)


class TeamDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a team.

    GET /api/v1/users/teams/{id}/
    PATCH /api/v1/users/teams/{id}/
    DELETE /api/v1/users/teams/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, team_id):
        org_id = request.user.organization_id
        try:
            team = Team.objects.prefetch_related("members").get(id=team_id, organization_id=org_id)
            serializer = TeamSerializer(team)
            return success_response(serializer.data)
        except Team.DoesNotExist:
            return error_response("Team not found.", status_code=status.HTTP_404_NOT_FOUND)

    def patch(self, request, team_id):
        org_id = request.user.organization_id
        try:
            team = Team.objects.get(id=team_id, organization_id=org_id)
        except Team.DoesNotExist:
            return error_response("Team not found.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = TeamCreateUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from accounts.models import User

        if "name" in serializer.validated_data:
            new_name = serializer.validated_data["name"].strip()
            if Team.objects.filter(organization_id=org_id, name__iexact=new_name).exclude(id=team_id).exists():
                return error_response(
                    f"Ya existe otro equipo llamado '{new_name}'.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            team.name = new_name

        if "description" in serializer.validated_data:
            team.description = serializer.validated_data["description"].strip()
        if "color" in serializer.validated_data:
            team.color = serializer.validated_data["color"]
        if "contact_email" in serializer.validated_data:
            team.contact_email = serializer.validated_data["contact_email"].strip()
        if "lead_id" in serializer.validated_data:
            lead_id = serializer.validated_data["lead_id"]
            if lead_id:
                lead_user = User.objects.filter(id=lead_id, organization_id=org_id).first()
                team.lead = lead_user
                if lead_user:
                    team.members.add(lead_user)
            else:
                team.lead = None

        if "member_ids" in serializer.validated_data:
            members = User.objects.filter(id__in=serializer.validated_data["member_ids"], organization_id=org_id)
            team.members.set(members)
            if team.lead and team.lead not in members:
                team.members.add(team.lead)

        team.save()

        from audit.services import AuditService
        AuditService.log(
            action="update",
            module="users",
            organization_id=org_id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"El usuario {request.user.email} actualizó el equipo '{team.name}'.",
        )

        response_serializer = TeamSerializer(team)
        return success_response(response_serializer.data)

    def delete(self, request, team_id):
        org_id = request.user.organization_id
        try:
            team = Team.objects.get(id=team_id, organization_id=org_id)
            team_name = team.name
            team.delete()

            from audit.services import AuditService
            AuditService.log(
                action="delete",
                module="users",
                organization_id=org_id,
                user_id=request.user.id,
                user_email=request.user.email,
                description=f"El usuario {request.user.email} eliminó el equipo '{team_name}'.",
            )
            return success_response({"detail": "Team deleted successfully."})
        except Team.DoesNotExist:
            return error_response("Team not found.", status_code=status.HTTP_404_NOT_FOUND)


class TeamSeedDefaultsView(APIView):
    """Endpoint for auto-provisioning 4 standard NOC/SRE teams if none exist.

    POST /api/v1/users/teams/seed-defaults/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        default_squads = [
            {
                "name": "SRE & Infraestructura",
                "description": "Responsables de clusters, balanceadores, bases de datos y alta disponibilidad.",
                "color": "#10B981",
            },
            {
                "name": "Soporte Nivel 1",
                "description": "Monitoreo 24/7 de alertas de conectividad, primera respuesta y mitigación de incidentes.",
                "color": "#3B82F6",
            },
            {
                "name": "SecOps & Ciberseguridad",
                "description": "Vigilancia de certificados TLS, cabeceras HTTP, reputación DNS y mitigación de ataques.",
                "color": "#8B5CF6",
            },
            {
                "name": "Backend & Core APIs",
                "description": "Mantenimiento y diagnóstico de endpoints REST, pasarelas de pago y microservicios.",
                "color": "#F59E0B",
            },
        ]
        created_count = 0
        for squad in default_squads:
            if not Team.objects.filter(organization_id=org_id, name=squad["name"]).exists():
                Team.objects.create(
                    organization_id=org_id,
                    name=squad["name"],
                    description=squad["description"],
                    color=squad["color"],
                )
                created_count += 1

        from audit.services import AuditService
        AuditService.log(
            action="create",
            module="users",
            organization_id=org_id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"Se aprovisionaron automáticamente {created_count} cuadrillas estándar para la organización.",
        )

        all_teams = Team.objects.filter(organization_id=org_id).prefetch_related("members")
        serializer = TeamSerializer(all_teams, many=True)
        return success_response(
            {
                "created_count": created_count,
                "teams": serializer.data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class TeamMembersView(APIView):
    """Endpoint for adding or removing members from a team.

    POST /api/v1/users/teams/{id}/members/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, team_id):
        org_id = request.user.organization_id
        try:
            team = Team.objects.get(id=team_id, organization_id=org_id)
        except Team.DoesNotExist:
            return error_response("Team not found.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = TeamMembersUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        action = serializer.validated_data["action"]
        member_ids = serializer.validated_data["member_ids"]
        from accounts.models import User
        users = User.objects.filter(id__in=member_ids, organization_id=org_id)

        if action == "add":
            team.members.add(*users)
        elif action == "remove":
            team.members.remove(*users)
        elif action == "set":
            team.members.set(users)

        response_serializer = TeamSerializer(team)
        return success_response(response_serializer.data)