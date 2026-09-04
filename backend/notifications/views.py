from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    NotificationBulkActionSerializer,
    NotificationChannelCreateSerializer,
    NotificationChannelSerializer,
    NotificationChannelUpdateSerializer,
    NotificationCreateSerializer,
    NotificationSerializer,
    TestChannelConfigSerializer,
)
from .services import NotificationChannelService, NotificationService


class NotificationChannelListView(APIView):
    """Endpoint for listing and creating notification channels.

    GET /api/v1/notifications/channels/
    POST /api/v1/notifications/channels/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        channels = NotificationChannelService.list_channels(org_id)
        serializer = NotificationChannelSerializer(channels, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = NotificationChannelCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            channel = NotificationChannelService.create_channel(
                organization_id=org_id,
                **serializer.validated_data,
            )
            response_serializer = NotificationChannelSerializer(channel)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class NotificationChannelDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a channel.

    GET /api/v1/notifications/channels/{id}/
    PATCH /api/v1/notifications/channels/{id}/
    DELETE /api/v1/notifications/channels/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, channel_id):
        org_id = request.user.organization_id
        try:
            channel = NotificationChannelService.get_channel(channel_id, org_id)
            serializer = NotificationChannelSerializer(channel)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Channel not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, channel_id):
        org_id = request.user.organization_id
        serializer = NotificationChannelUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            channel = NotificationChannelService.update_channel(
                channel_id, org_id, **serializer.validated_data
            )
            response_serializer = NotificationChannelSerializer(channel)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Channel not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, channel_id):
        org_id = request.user.organization_id
        try:
            NotificationChannelService.delete_channel(channel_id, org_id)
            return success_response({"detail": "Channel deleted."})
        except Exception:
            return error_response(
                "Channel not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class NotificationChannelBulkActionView(APIView):
    """Endpoint for bulk actions on notification channels.

    POST /api/v1/notifications/channels/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = NotificationBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Datos inválidos.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        result = NotificationChannelService.bulk_action(
            organization_id=org_id,
            action=serializer.validated_data["action"],
            channel_ids=serializer.validated_data["channel_ids"],
        )
        return success_response(result)


class NotificationListView(APIView):
    """Endpoint for listing and creating notifications.

    GET /api/v1/notifications/?status=sent
    POST /api/v1/notifications/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        status_filter = request.query_params.get("status")
        notifications = NotificationService.list_notifications(
            org_id, status_filter=status_filter
        )
        serializer = NotificationSerializer(notifications, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = NotificationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            notification = NotificationService.create_notification(
                organization_id=org_id,
                channel_id=serializer.validated_data["channel_id"],
                title=serializer.validated_data["title"],
                message=serializer.validated_data["message"],
                severity=serializer.validated_data.get("severity", "info"),
                event_type=serializer.validated_data.get("event_type", "manual"),
            )
            from .tasks import send_notification_task
            send_notification_task.delay(str(notification.id))

            response_serializer = NotificationSerializer(notification)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class NotificationDetailView(APIView):
    """Endpoint for retrieving a notification.

    GET /api/v1/notifications/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, notification_id):
        org_id = request.user.organization_id
        try:
            notification = NotificationService.get_notification(
                notification_id, org_id
            )
            serializer = NotificationSerializer(notification)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Notification not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class NotificationRetryView(APIView):
    """Endpoint to re-dispatch a failed notification in 1-click.

    POST /api/v1/notifications/{id}/retry/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, notification_id):
        org_id = request.user.organization_id
        try:
            notification = NotificationService.retry_notification(notification_id, org_id)
            serializer = NotificationSerializer(notification)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class NotificationChannelTestView(APIView):
    """Endpoint to trigger a test notification for a registered channel.

    POST /api/v1/notifications/channels/{id}/test/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, channel_id):
        org_id = request.user.organization_id
        try:
            notification = NotificationService.test_channel(channel_id, org_id)
            serializer = NotificationSerializer(notification)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class NotificationTestConnectionView(APIView):
    """Endpoint for pre-flight live connection testing before saving a channel.

    POST /api/v1/notifications/test-connection/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = TestChannelConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Parámetros de prueba inválidos.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        result = NotificationService.test_channel_config(
            channel_type=serializer.validated_data["channel_type"],
            config=serializer.validated_data["config"],
            custom_title=serializer.validated_data.get("custom_title"),
            custom_message=serializer.validated_data.get("custom_message"),
        )
        return success_response(result)


class NotificationStatsView(APIView):
    """Endpoint for notifications KPI statistics.

    GET /api/v1/notifications/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = NotificationService.get_notification_stats(org_id)
        return success_response(stats_data)


class NotificationExportCsvView(APIView):
    """Endpoint to export recent notifications as CSV with UTF-8 BOM.

    GET /api/v1/notifications/export-csv/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        csv_content = NotificationService.export_csv(org_id)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        filename = f"sentinel_notificaciones_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response