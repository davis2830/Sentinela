import csv
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from common.responses import error_response, success_response
from .serializers import (
    StatusPageConfigSerializer,
    StatusPageConfigUpdateSerializer,
    StatusPageSummarySerializer,
    StatusPageCreateSerializer,
    ScheduledMaintenanceSerializer,
    ScheduledMaintenanceCreateSerializer,
    MaintenanceUpdateSerializer,
    MaintenanceUpdateCreateSerializer,
    MaintenanceBulkActionSerializer,
    StatusPageSubscriberSerializer,
    PublicSubscribeSerializer,
)
from .services import StatusPageService


class StatusPageListView(APIView):
    """Endpoint for listing and creating Status Pages for an organization.

    GET /api/v1/status-page/pages/
    POST /api/v1/status-page/pages/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        pages = StatusPageService.list_status_pages(org_id)
        serializer = StatusPageSummarySerializer(pages, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = StatusPageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            page = StatusPageService.create_status_page(org_id, serializer.validated_data)
            res_serializer = StatusPageConfigSerializer(page)
            return success_response(res_serializer.data, status_code=status.HTTP_201_CREATED)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class StatusPageDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a specific Status Page.

    GET /api/v1/status-page/pages/<uuid:page_id>/
    PATCH /api/v1/status-page/pages/<uuid:page_id>/
    DELETE /api/v1/status-page/pages/<uuid:page_id>/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, page_id):
        org_id = request.user.organization_id
        try:
            page = StatusPageService.get_status_page(org_id, page_id)
            serializer = StatusPageConfigSerializer(page)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_404_NOT_FOUND)

    def patch(self, request, page_id):
        org_id = request.user.organization_id
        serializer = StatusPageConfigUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            page = StatusPageService.update_config(org_id, serializer.validated_data, page_id=page_id)
            res_serializer = StatusPageConfigSerializer(page)
            return success_response(res_serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, page_id):
        org_id = request.user.organization_id
        try:
            StatusPageService.delete_status_page(org_id, page_id)
            return success_response({"message": "Status Page eliminada correctamente."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class StatusPageSetDefaultView(APIView):
    """Endpoint for setting a status page as the primary default one.

    POST /api/v1/status-page/pages/<uuid:page_id>/set-default/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, page_id):
        org_id = request.user.organization_id
        try:
            page = StatusPageService.set_default_status_page(org_id, page_id)
            return success_response({"message": f"'{page.company_name}' es ahora la Status Page principal."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class StatusPageConfigView(APIView):
    """Endpoint for retrieving and updating Status Page settings for an organization.

    GET /api/v1/status-page/config/?page_id=<uuid>
    PATCH /api/v1/status-page/config/?page_id=<uuid>
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        config = StatusPageService.get_or_create_config(org_id, page_id=page_id)
        serializer = StatusPageConfigSerializer(config)
        return success_response(serializer.data)

    def patch(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        serializer = StatusPageConfigUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        config = StatusPageService.update_config(org_id, serializer.validated_data, page_id=page_id)
        res_serializer = StatusPageConfigSerializer(config)
        return success_response(res_serializer.data)


class StatusPageStatsView(APIView):
    """Endpoint for retrieving Status Page administrative telemetry and KPIs.

    GET /api/v1/status-page/stats/?page_id=<uuid>
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        data = StatusPageService.get_admin_stats(org_id, page_id=page_id)
        return success_response(data)


class StatusPageAvailableTargetsView(APIView):
    """Endpoint for fetching all potential targets that can be included in the Status Page.

    GET /api/v1/status-page/available-targets/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        targets = StatusPageService.get_available_targets(org_id)
        return success_response(targets)


class MaintenanceListView(APIView):
    """Endpoint for listing and creating scheduled maintenances.

    GET /api/v1/status-page/maintenances/
    POST /api/v1/status-page/maintenances/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        maintenances = StatusPageService.list_maintenances(org_id, page_id=page_id)
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


class MaintenanceBulkActionView(APIView):
    """Endpoint for atomic bulk actions on scheduled maintenances.

    POST /api/v1/status-page/maintenances/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = MaintenanceBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            result = StatusPageService.bulk_action_maintenances(
                organization_id=org_id,
                action=serializer.validated_data["action"],
                maintenance_ids=serializer.validated_data["maintenance_ids"],
            )
            return success_response(result)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


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


class MaintenanceUpdateView(APIView):
    """Endpoint for publishing a progress update on a maintenance window.

    POST /api/v1/status-page/maintenances/{id}/updates/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, maintenance_id):
        org_id = request.user.organization_id
        serializer = MaintenanceUpdateCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            update = StatusPageService.add_maintenance_update(
                maintenance_id=maintenance_id,
                organization_id=org_id,
                message=serializer.validated_data["message"],
                update_status=serializer.validated_data.get("status"),
            )
            res_serializer = MaintenanceUpdateSerializer(update)
            return success_response(res_serializer.data, status_code=status.HTTP_201_CREATED)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SubscriberListView(APIView):
    """Endpoint for listing all active subscribers.

    GET /api/v1/status-page/subscribers/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        subs = StatusPageService.list_subscribers(org_id, page_id=page_id)
        serializer = StatusPageSubscriberSerializer(subs, many=True)
        return success_response(serializer.data)


class SubscriberDeleteView(APIView):
    """Endpoint for removing a subscriber from admin panel.

    DELETE /api/v1/status-page/subscribers/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def delete(self, request, subscriber_id):
        org_id = request.user.organization_id
        try:
            StatusPageService.remove_subscriber(org_id, subscriber_id)
            return success_response(status_code=status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SubscriberExportCSVView(APIView):
    """Export subscribers list in CSV format with UTF-8 BOM.

    GET /api/v1/status-page/subscribers/export/?page_id=<uuid>
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        page_id = request.query_params.get("page_id")
        subs = StatusPageService.list_subscribers(org_id, page_id=page_id)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="sentinel_suscriptores.csv"'
        response.write("\ufeff")  # UTF-8 BOM

        writer = csv.writer(response)
        writer.writerow(["ID", "Email", "Activo", "Fecha de Suscripción"])

        for s in subs:
            writer.writerow([str(s.id), s.email, "Sí" if s.is_active else "No", s.created_at.isoformat()])

        return response


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


class PublicSubscribeView(APIView):
    """Public endpoint for subscribing an email address to status updates.

    POST /api/v1/status-page/public/{slug}/subscribe/
    No authentication required (AllowAny).
    """

    permission_classes = (AllowAny,)

    def post(self, request, slug):
        serializer = PublicSubscribeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            sub = StatusPageService.subscribe_email(slug, serializer.validated_data["email"])
            return success_response({
                "message": "Te has suscrito exitosamente a las actualizaciones.",
                "email": sub.email,
            }, status_code=status.HTTP_201_CREATED)
        except ValueError as v_err:
            return error_response(str(v_err), status_code=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class PublicUnsubscribeView(APIView):
    """Public endpoint for unsubscribing an email address from status updates.

    POST /api/v1/status-page/public/{slug}/unsubscribe/
    No authentication required (AllowAny).
    """

    permission_classes = (AllowAny,)

    def post(self, request, slug):
        serializer = PublicSubscribeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        try:
            StatusPageService.unsubscribe_email(slug, serializer.validated_data["email"])
            return success_response({"message": "Te has desuscrito correctamente."})
        except ValueError as v_err:
            return error_response(str(v_err), status_code=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
