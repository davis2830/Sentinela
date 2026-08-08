from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    MonitoringCheckSerializer,
    MonitoringTargetCreateSerializer,
    MonitoringTargetSerializer,
    MonitoringTargetUpdateSerializer,
)
from .services import MonitoringService


class MonitoringTargetListView(APIView):
    """Endpoint for listing and creating monitoring targets.

    GET /api/v1/monitoring-targets/
    POST /api/v1/monitoring-targets/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        targets = MonitoringService.list_targets(org_id)
        serializer = MonitoringTargetSerializer(targets, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = MonitoringTargetCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = MonitoringService.create_target(
                organization_id=org_id,
                name=serializer.validated_data["name"],
                target_type=serializer.validated_data["target_type"],
                endpoint=serializer.validated_data["endpoint"],
                interval=serializer.validated_data.get("interval", 60),
                enabled=serializer.validated_data.get("enabled", True),
            )
            response_serializer = MonitoringTargetSerializer(target)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class MonitoringTargetDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a target.

    GET /api/v1/monitoring-targets/{id}/
    PATCH /api/v1/monitoring-targets/{id}/
    DELETE /api/v1/monitoring-targets/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = MonitoringService.get_target(target_id, org_id)
            serializer = MonitoringTargetSerializer(target)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Target not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, target_id):
        org_id = request.user.organization_id
        serializer = MonitoringTargetUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = MonitoringService.update_target(
                target_id, org_id, **serializer.validated_data
            )
            response_serializer = MonitoringTargetSerializer(target)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Target not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, target_id):
        org_id = request.user.organization_id
        try:
            MonitoringService.delete_target(target_id, org_id)
            return success_response({"detail": "Target deleted."})
        except Exception:
            return error_response(
                "Target not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class MonitoringCheckListView(APIView):
    """Endpoint for listing checks for a target.

    GET /api/v1/monitoring-targets/{id}/checks/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        limit = int(request.query_params.get("limit", 100))
        try:
            checks = MonitoringService.list_checks(target_id, org_id, limit=limit)
            serializer = MonitoringCheckSerializer(checks, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Target not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class MonitoringUptimeView(APIView):
    """Endpoint for uptime statistics.

    GET /api/v1/monitoring-targets/{id}/uptime/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        hours = int(request.query_params.get("hours", 24))
        try:
            stats = MonitoringService.get_uptime_stats(
                target_id, org_id, hours=hours
            )
            return success_response(stats)
        except Exception:
            return error_response(
                "Target not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class MonitoringTargetScanView(APIView):
    """Endpoint for manual execution of a monitoring target check.

    POST /api/v1/monitoring/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = MonitoringService.get_target(target_id, org_id)
            from .tasks import run_monitoring_check
            run_monitoring_check(str(target.id))
            target.refresh_from_db()
            serializer = MonitoringTargetSerializer(target)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )