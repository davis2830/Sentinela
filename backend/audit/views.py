from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import success_response

from .serializers import AuditLogSerializer
from .services import AuditService


class AuditLogListView(APIView):
    """Endpoint for listing audit logs (read-only).

    GET /api/v1/audit-logs/?action=login&module=accounts&limit=50
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        action = request.query_params.get("action")
        module = request.query_params.get("module")
        user_id = request.query_params.get("user_id")
        limit = int(request.query_params.get("limit", 100))

        logs = AuditService.list_logs(
            organization_id=org_id,
            action=action,
            module=module,
            user_id=user_id,
            limit=limit,
        )
        serializer = AuditLogSerializer(logs, many=True)
        return success_response(serializer.data)


class AuditLogDetailView(APIView):
    """Endpoint for retrieving a single audit log entry (read-only).

    GET /api/v1/audit-logs/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, log_id):
        from .models import AuditLog
        from common.responses import error_response
        from rest_framework import status

        try:
            log = AuditLog.objects.get(id=log_id, organization_id=request.user.organization_id)
            serializer = AuditLogSerializer(log)
            return success_response(serializer.data)
        except AuditLog.DoesNotExist:
            return error_response(
                "Audit log not found.", status_code=status.HTTP_404_NOT_FOUND
            )