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
            from audit.services import AuditService
            AuditService.log_from_request(
                request,
                action="create",
                module="monitoring",
                description=f"El usuario creó el objetivo de monitoreo {target.name} ({target.target_type.upper()}: {target.endpoint}).",
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
            from audit.services import AuditService
            AuditService.log_from_request(
                request,
                action="update",
                module="monitoring",
                description=f"El usuario actualizó el objetivo de monitoreo {target.name}.",
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
            target = MonitoringService.get_target(target_id, org_id)
            target_name = target.name
            target_endpoint = target.endpoint
            MonitoringService.delete_target(target_id, org_id)
            from audit.services import AuditService
            AuditService.log_from_request(
                request,
                action="delete",
                module="monitoring",
                description=f"El usuario eliminó el objetivo de monitoreo {target_name} ({target_endpoint}).",
            )
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


class GlobalSearchView(APIView):
    """Unified search endpoint for Omnibar Ctrl+K.

    GET /api/v1/monitoring/search/?q=query
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return success_response([])

        org_id = request.user.organization_id
        results = []

        # 1. Monitoring Targets
        from .models import MonitoringTarget
        targets = MonitoringTarget.objects.filter(
            organization_id=org_id, name__icontains=query
        )[:5]
        for t in targets:
            results.append({
                "id": str(t.id),
                "title": t.name,
                "subtitle": t.endpoint,
                "category": "Uptime & Servidores",
                "url": "/monitoring",
            })

        # 2. SSL Certificates
        from ssl_monitor.models import SSLCertificate
        certs = SSLCertificate.objects.filter(
            organization_id=org_id, domain__icontains=query
        )[:5]
        for c in certs:
            results.append({
                "id": str(c.id),
                "title": c.domain,
                "subtitle": f"Emisor: {c.issuer or 'Desconocido'}",
                "category": "Certificados SSL",
                "url": "/ssl",
            })

        # 3. DNS Records
        from dns_monitor.models import DNSRecord
        dns_recs = DNSRecord.objects.filter(
            organization_id=org_id, domain__icontains=query
        )[:5]
        for d in dns_recs:
            results.append({
                "id": str(d.id),
                "title": f"{d.domain} ({d.record_type})",
                "subtitle": d.value or "",
                "category": "Registros DNS",
                "url": "/dns",
            })

        # 4. API Endpoints
        from api_checks.models import APICheckTarget
        api_t = APICheckTarget.objects.filter(
            organization_id=org_id, name__icontains=query
        )[:5]
        for a in api_t:
            results.append({
                "id": str(a.id),
                "title": a.name,
                "subtitle": a.url,
                "category": "API Endpoints",
                "url": "/api-checks",
            })

        # 5. Alerts
        from alerts.models import Alert
        alerts = Alert.objects.filter(
            organization_id=org_id, title__icontains=query
        )[:5]
        for al in alerts:
            results.append({
                "id": str(al.id),
                "title": al.title,
                "subtitle": f"Severidad: {al.severity.upper()}",
                "category": "Smart Alerts",
                "url": "/alerts",
            })

        # 6. Incidents
        from incidents.models import Incident
        incidents = Incident.objects.filter(
            organization_id=org_id, title__icontains=query
        )[:5]
        for inc in incidents:
            results.append({
                "id": str(inc.id),
                "title": inc.title,
                "subtitle": f"Estado: {inc.status.upper()}",
                "category": "Incidentes",
                "url": "/incidents",
            })

        return success_response(results)