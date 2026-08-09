from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from common.responses import error_response, success_response
from .serializers import (
    StatusPageConfigSerializer,
    StatusPageConfigUpdateSerializer,
    ScheduledMaintenanceSerializer,
    ScheduledMaintenanceCreateSerializer,
)
from .services import StatusPageService


class StatusPageConfigView(APIView):
    """Endpoint for retrieving and updating Status Page settings for an organization.

    GET /api/v1/status-page/config/
    PATCH /api/v1/status-page/config/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        config = StatusPageService.get_or_create_config(org_id)
        serializer = StatusPageConfigSerializer(config)
        return success_response(serializer.data)

    def patch(self, request):
        org_id = request.user.organization_id
        serializer = StatusPageConfigUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        config = StatusPageService.update_config(org_id, serializer.validated_data)
        res_serializer = StatusPageConfigSerializer(config)
        return success_response(res_serializer.data)


class MaintenanceListView(APIView):
    """Endpoint for listing and creating scheduled maintenances.

    GET /api/v1/status-page/maintenances/
    POST /api/v1/status-page/maintenances/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        maintenances = StatusPageService.list_maintenances(org_id)
        serializer = ScheduledMaintenanceSerializer(maintenances, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = ScheduledMaintenanceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        m = StatusPageService.create_maintenance(org_id, serializer.validated_data)
        res_serializer = ScheduledMaintenanceSerializer(m)
        return success_response(res_serializer.data, status_code=status.HTTP_201_CREATED)


class MaintenanceDetailView(APIView):
    """Endpoint for updating or deleting a scheduled maintenance.

    PATCH /api/v1/status-page/maintenances/{id}/
    DELETE /api/v1/status-page/maintenances/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def patch(self, request, maintenance_id):
        org_id = request.user.organization_id
        try:
            m = StatusPageService.update_maintenance(maintenance_id, org_id, request.data)
            serializer = ScheduledMaintenanceSerializer(m)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, maintenance_id):
        org_id = request.user.organization_id
        try:
            StatusPageService.delete_maintenance(maintenance_id, org_id)
            return success_response(status_code=status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class PublicStatusPageView(APIView):
    """Public endpoint for retrieving Status Page dashboard by slug.

    GET /api/v1/status-page/public/{slug}/
    No authentication required (AllowAny).
    """

    permission_classes = (AllowAny,)

    def get(self, request, slug):
        try:
            data = StatusPageService.get_public_status_data(slug)
            return success_response(data)
        except PermissionError as p_err:
            return error_response(str(p_err), status_code=status.HTTP_403_FORBIDDEN)
        except ValueError as v_err:
            return error_response(str(v_err), status_code=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
