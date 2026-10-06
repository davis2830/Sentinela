from rest_framework.exceptions import ValidationError

from common.permissions import IsAdminOrReadOnly
from common.responses import error_response, success_response
from common.subscriptions import OperationalAPIView
from .models import MonitoringTarget
from .coverage import snapshot, set_links


class TargetCoverageView(OperationalAPIView):
    permission_classes = (IsAdminOrReadOnly,)

    def get(self, request, target_id):
        target = MonitoringTarget.objects.filter(pk=target_id, organization_id=request.user.organization_id).first()
        if not target:
            return error_response("Endpoint no encontrado.", status_code=404)
        return success_response(snapshot(target, request))

    def patch(self, request, target_id):
        try:
            set_links(target_id, request.user.organization_id, request.data, request)
            target = MonitoringTarget.objects.get(pk=target_id, organization_id=request.user.organization_id)
            return success_response(snapshot(target, request))
        except MonitoringTarget.DoesNotExist:
            return error_response("Endpoint no encontrado.", status_code=404)
        except ValidationError as exc:
            return error_response("No se pudo vincular la cobertura.", errors=exc.detail, status_code=400)
