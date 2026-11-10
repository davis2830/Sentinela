from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.responses import success_response, error_response
from common.permissions import IsOrganizationMember
from accounts.platform_auth import PlatformAPIView
from .models import AuditLog
from .serializers import AuditLogSerializer
from .services import AuditService
from django.db.models import Q
from organizations.models import Organization


class PlatformAuditQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, max_value=1000000, default=1)
    email = serializers.CharField(max_length=255, required=False)
    organization = serializers.CharField(max_length=255, required=False)
    action = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=50, required=False)
    module = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=50, required=False)
    result = serializers.ChoiceField(choices=['success', 'failure'], required=False)
    since = serializers.DateTimeField(required=False)
    until = serializers.DateTimeField(required=False)
    organization_id = serializers.UUIDField(required=False)
    user_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        if attrs.get('since') and attrs.get('until') and attrs['since'] >= attrs['until']:
            raise serializers.ValidationError('La fecha inicial debe ser anterior a la final.')
        return attrs


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


class PlatformAuditLogListView(PlatformAPIView):
    def get(self, request):
        if 'page' in request.query_params:
            query = PlatformAuditQuerySerializer(data=request.query_params)
            query.is_valid(raise_exception=True)
            filters = query.validated_data
            logs = AuditLog.objects.all()
            for field in ('organization_id', 'user_id'):
                if filters.get(field):
                    logs = logs.filter(**{field: filters[field]})
            if filters.get('email'):
                logs = logs.filter(user_email__icontains=filters['email'])
            if filters.get('organization'):
                term = filters['organization']
                organizations = Organization.objects.filter(Q(name__icontains=term) | Q(slug__icontains=term))
                logs = logs.filter(organization_id__in=organizations.values('id'))
            for field in ('action', 'module', 'result'):
                if filters.get(field):
                    logs = logs.filter(**{field: filters[field]})
            if filters.get('since'):
                logs = logs.filter(timestamp__gte=filters['since'])
            if filters.get('until'):
                logs = logs.filter(timestamp__lt=filters['until'])
            offset = (filters['page'] - 1) * 25
            rows = list(logs.order_by('-timestamp', '-id')[offset:offset + 26])
            return success_response({'events': AuditLogSerializer(rows[:25], many=True).data,
                                     'page': filters['page'], 'has_next': len(rows) > 25})
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


class PlatformAuditOptionsView(PlatformAPIView):
    def get(self, request):
        labels = {'login': 'Inicio de sesión', 'logout': 'Cierre de sesión', 'create': 'Creación',
                  'update': 'Actualización', 'delete': 'Eliminación', 'config_change': 'Configuración',
                  'accounts': 'Cuentas', 'organization': 'Organizaciones', 'subscription': 'Suscripciones',
                  'platform_users': 'Soporte a usuarios', 'platform_session': 'Sesión administrativa', 'beta': 'Beta'}
        return success_response({
            'actions': [{'id': key, 'label': labels.get(key, label)} for key, label in AuditLog.Action.choices],
            'modules': [{'id': key, 'label': labels.get(key, key.replace('_', ' ').capitalize())}
                        for key in AuditLog.objects.order_by('module').values_list('module', flat=True).distinct()],
        })


class PlatformAuditDetailView(PlatformAPIView):
    def get(self, request, log_id):
        log = AuditLog.objects.filter(pk=log_id).values('id', 'organization_id', 'user_id', 'user_email',
            'action', 'module', 'result', 'timestamp', 'description').first()
        if log is None:
            return error_response('Evento no encontrado.', status_code=404)
        return success_response(log)
