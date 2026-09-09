from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response
from .serializers import (
    MaintenanceWindowSerializer,
    MaintenanceWindowCreateSerializer,
    MaintenanceWindowPatchSerializer,
    MaintenanceWindowProgressUpdateSerializer,
    MaintenanceWindowBulkActionSerializer,
    MaintenanceWindowUpdateSerializer,
)
from .services import MaintenanceWindowService


class MaintenanceWindowStatsView(APIView):
    """Retrieve operational NOC statistics for maintenance windows.

    GET /api/v1/maintenance/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        try:
            stats = MaintenanceWindowService.get_stats(org_id)
            return success_response(stats)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowBulkActionView(APIView):
    """Atomic bulk actions (start, complete, cancel, delete) across maintenance windows.

    POST /api/v1/maintenance/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = MaintenanceWindowBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            result = MaintenanceWindowService.bulk_action(
                organization_id=org_id,
                maintenance_ids=serializer.validated_data["maintenance_ids"],
                action=serializer.validated_data["action"],
                user=request.user,
            )
            return success_response(result)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowListView(APIView):
    """List and create maintenance windows.

    GET /api/v1/maintenance/
    POST /api/v1/maintenance/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        status_filter = request.query_params.get("status")
        team_id = request.query_params.get("team_id")
        search = request.query_params.get("search")

        try:
            windows = MaintenanceWindowService.list_windows(
                organization_id=org_id,
                status_filter=status_filter,
                team_id=team_id,
                search=search,
            )
            serializer = MaintenanceWindowSerializer(windows, many=True)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = MaintenanceWindowCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        org = getattr(request.user, "organization", None)
        if org:
            try:
                from organizations.services import QuotaService, FeatureNotAllowedException
                QuotaService.check_feature_access(org, "maintenance_windows")
            except FeatureNotAllowedException as fe:
                return error_response(
                    str(fe),
                    errors={"code": "FEATURE_NOT_INCLUDED", "feature": fe.feature_name, "plan": fe.plan_tier},
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        try:
            window = MaintenanceWindowService.create_window(
                organization_id=org_id,
                data=serializer.validated_data,
                user=request.user,
            )
            res_serializer = MaintenanceWindowSerializer(window)
            return success_response(res_serializer.data, status_code=status.HTTP_201_CREATED)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowDetailView(APIView):
    """Retrieve, update, or delete a single maintenance window.

    GET /api/v1/maintenance/<id>/
    PATCH /api/v1/maintenance/<id>/
    DELETE /api/v1/maintenance/<id>/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, window_id):
        org_id = request.user.organization_id
        try:
            window = MaintenanceWindowService.get_window(window_id, org_id)
            serializer = MaintenanceWindowSerializer(window)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response("Ventana de mantenimiento no encontrada.", status_code=status.HTTP_404_NOT_FOUND)

    def patch(self, request, window_id):
        org_id = request.user.organization_id
        try:
            window = MaintenanceWindowService.get_window(window_id, org_id)
        except Exception:
            return error_response("Ventana de mantenimiento no encontrada.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = MaintenanceWindowPatchSerializer(window, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            updated = MaintenanceWindowService.update_window(
                window_id=window_id,
                organization_id=org_id,
                data=serializer.validated_data,
                user=request.user,
            )
            res_serializer = MaintenanceWindowSerializer(updated)
            return success_response(res_serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, window_id):
        org_id = request.user.organization_id
        try:
            MaintenanceWindowService.delete_window(window_id, org_id, user=request.user)
            return success_response({"deleted": True})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowStartView(APIView):
    """Transition maintenance window immediately to in_progress.

    POST /api/v1/maintenance/<id>/start/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, window_id):
        org_id = request.user.organization_id
        try:
            window = MaintenanceWindowService.start_window(window_id, org_id, user=request.user)
            return success_response(MaintenanceWindowSerializer(window).data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowCompleteView(APIView):
    """Transition maintenance window immediately to completed.

    POST /api/v1/maintenance/<id>/complete/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, window_id):
        org_id = request.user.organization_id
        try:
            window = MaintenanceWindowService.complete_window(window_id, org_id, user=request.user)
            return success_response(MaintenanceWindowSerializer(window).data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowCancelView(APIView):
    """Transition maintenance window immediately to cancelled.

    POST /api/v1/maintenance/<id>/cancel/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, window_id):
        org_id = request.user.organization_id
        try:
            window = MaintenanceWindowService.cancel_window(window_id, org_id, user=request.user)
            return success_response(MaintenanceWindowSerializer(window).data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowProgressUpdateView(APIView):
    """Log a progress update / milestone note to a maintenance window.

    POST /api/v1/maintenance/<id>/updates/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, window_id):
        org_id = request.user.organization_id
        serializer = MaintenanceWindowProgressUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            update = MaintenanceWindowService.add_update(
                window_id=window_id,
                organization_id=org_id,
                message=serializer.validated_data["message"],
                status=serializer.validated_data.get("status"),
                user=request.user,
            )
            return success_response(
                MaintenanceWindowUpdateSerializer(update).data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
