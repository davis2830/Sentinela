from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.responses import success_response, error_response
from common.permissions import IsOrganizationMember, IsSuperUser
from .models import AuditLog
from .serializers import AuditLogSerializer
from .services import AuditService


class AuditQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=500, default=100)
    action = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=50, required=False)
    module = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=50, required=False)
    user_id = serializers.UUIDField(required=False)


class AuditLogListView(APIView):
    """Read only the exact tenant scope; global entries belong to platform admin."""
    permission_classes = (IsAuthenticated, IsOrganizationMember)

    def get(self, request):
        query = AuditQuerySerializer(data=request.query_params)
        if not query.is_valid():
            return error_response('Filtros de auditoría inválidos.', errors=query.errors, status_code=400)
        logs = AuditService.list_logs(organization_id=request.user.organization_id, **query.validated_data)
        return success_response(AuditLogSerializer(logs, many=True).data)


class PlatformAuditLogListView(APIView):
    permission_classes = (IsSuperUser,)

    def get(self, request):
        query = AuditQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return success_response(AuditLogSerializer(AuditService.list_logs(**query.validated_data), many=True).data)


class AuditLogDetailView(APIView):
    permission_classes = (IsAuthenticated, IsOrganizationMember)

    def get(self, request, log_id):
        try:
            log = AuditLog.objects.get(id=log_id, organization_id=request.user.organization_id)
            return success_response(AuditLogSerializer(log).data)
        except AuditLog.DoesNotExist:
            return error_response('Audit log not found.', status_code=status.HTTP_404_NOT_FOUND)
