from rest_framework.permissions import IsAuthenticated
from common.permissions import IsOrgAdmin
from common.subscriptions import OperationalAPIView
from common.responses import success_response
from django.shortcuts import get_object_or_404
from .models import AgentProbe
from .serializers import AgentProbeSerializer
from .probe_installation import profile
from .probe_management import impact, revoke
from rest_framework.views import APIView
from common.responses import error_response
from common.subscriptions import monitoring_allowed
from common.authorization import AuthorizedAPIView


class ProbeDiagnosticView(APIView):
    """Authenticate without heartbeat, task admission or mutation."""

    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        from .services import AgentProbeService

        probe = AgentProbeService.authenticate_token(request.headers.get("X-Probe-Token", ""))
        if not probe:
            return error_response("Token no válido o revocado.", status_code=401)
        response = success_response(
            {"authenticated": True, "protocol": 2, "monitoring_allowed": monitoring_allowed(probe.organization)}
        )
        response["Cache-Control"] = "no-store"
        return response


class ProbeReadView(OperationalAPIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, probe_id):
        probe = get_object_or_404(AgentProbe, pk=probe_id, organization_id=request.user.organization_id)
        data = AgentProbeSerializer(probe).data
        data["impact"] = impact(probe)
        return success_response(data)


class ProbeInstallationView(OperationalAPIView):
    permission_classes = (IsAuthenticated, IsOrgAdmin)

    def get(self, request, probe_id):
        probe = get_object_or_404(AgentProbe, pk=probe_id, organization_id=request.user.organization_id)
        response = success_response(
            profile(
                probe,
                request.query_params.get("platform", "linux"),
                request.query_params.get("distribution", "registry"),
            )
        )
        response["Cache-Control"] = "no-store"
        return response


class ProbeRevokeView(AuthorizedAPIView):
    permission_classes = (IsAuthenticated, IsOrgAdmin)

    def post(self, request, probe_id):
        probe = get_object_or_404(AgentProbe, pk=probe_id, organization_id=request.user.organization_id)
        revoke(probe.pk, probe.organization_id, request.data.get("reason"), request.user)
        return success_response(
            {"message": "Senti9 revocado. Sus monitores quedaron pausados; el historial se conserva."}
        )
