from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    MonitoringCheckSerializer,
    MonitoringTargetCreateSerializer,
    MonitoringTargetSerializer,
    MonitoringTargetUpdateSerializer,
    MaintenanceWindowSerializer,
)
from .models import MaintenanceWindow
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
                tags=serializer.validated_data.get("tags", []),
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


class MonitoringTimeseriesView(APIView):
    """Endpoint for high-resolution downsampled timeseries, availability heatmap and downtime incidents.

    GET /api/v1/monitoring-targets/{id}/timeseries/?period=24h|7d|30d
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        period = request.query_params.get("period", "24h").strip().lower()
        if period not in ("24h", "7d", "30d"):
            period = "24h"
        try:
            data = MonitoringService.get_timeseries_metrics(
                target_id, org_id, period=period
            )
            return success_response(data)
        except Exception as exc:
            return error_response(
                f"Error retrieving timeseries: {str(exc)}",
                status_code=status.HTTP_400_BAD_REQUEST,
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


class MonitoringTargetBulkScanView(APIView):
    """Endpoint to trigger bulk check for all enabled targets.

    POST /api/v1/monitoring/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import schedule_all_checks
            schedule_all_checks.delay()
            return success_response({"message": "Re-escaneo masivo de objetivos iniciado."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


import csv
from django.http import HttpResponse

class MonitoringTargetExportView(APIView):
    """Endpoint to export a target's monitoring history as CSV.

    GET /api/v1/monitoring-targets/{id}/export/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = MonitoringService.get_target(target_id, org_id)
            checks = target.checks.all().order_by("-checked_at")

            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="monitoring_history_{target.name.replace(" ", "_")}.csv"'

            writer = csv.writer(response)
            writer.writerow(["ID", "Fecha (UTC)", "Estado", "Latencia (ms)", "Detalles"])

            for check in checks:
                writer.writerow([
                    str(check.id),
                    check.checked_at.isoformat(),
                    check.status.upper(),
                    check.latency if check.latency is not None else "",
                    str(check.details),
                ])

            return response
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowListView(APIView):
    """Endpoint for listing and creating maintenance windows for a target.

    GET /api/v1/monitoring-targets/{target_id}/maintenance-windows/
    POST /api/v1/monitoring-targets/{target_id}/maintenance-windows/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = MonitoringService.get_target(target_id, org_id)
            windows = target.maintenance_windows.all()
            serializer = MaintenanceWindowSerializer(windows, many=True)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def post(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = MonitoringService.get_target(target_id, org_id)
            data = request.data.copy()
            data["target"] = str(target.id)

            serializer = MaintenanceWindowSerializer(data=data)
            if not serializer.is_valid():
                return error_response(
                    "Invalid input.",
                    errors=serializer.errors,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            serializer.save()
            return success_response(
                serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class MaintenanceWindowDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a maintenance window.

    PATCH /api/v1/monitoring-targets/maintenance-windows/{window_id}/
    DELETE /api/v1/monitoring-targets/maintenance-windows/{window_id}/
    """

    permission_classes = (IsAuthenticated,)

    def patch(self, request, window_id):
        try:
            window = MaintenanceWindow.objects.get(id=window_id)
            org_id = request.user.organization_id
            if window.target.organization_id != org_id:
                return error_response("Forbidden", status_code=status.HTTP_403_FORBIDDEN)

            serializer = MaintenanceWindowSerializer(window, data=request.data, partial=True)
            if not serializer.is_valid():
                return error_response(
                    "Invalid input.",
                    errors=serializer.errors,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            serializer.save()
            return success_response(serializer.data)
        except MaintenanceWindow.DoesNotExist:
            return error_response("Not found.", status_code=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, window_id):
        try:
            window = MaintenanceWindow.objects.get(id=window_id)
            org_id = request.user.organization_id
            if window.target.organization_id != org_id:
                return error_response("Forbidden", status_code=status.HTTP_403_FORBIDDEN)

            window.delete()
            return success_response({"detail": "Maintenance window deleted."})
        except MaintenanceWindow.DoesNotExist:
            return error_response("Not found.", status_code=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


import socket
import time
import requests


class TestConnectionView(APIView):
    """Diagnose and test target connection on the fly without persistence."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        endpoint = request.data.get("endpoint", "").strip()
        target_type = request.data.get("target_type", "http").lower()
        http_method = request.data.get("http_method", "GET").upper()
        expected_status = int(request.data.get("expected_status", 200))
        custom_headers = request.data.get("custom_headers", {})
        request_body = request.data.get("request_body", "")
        max_latency_ms = float(request.data.get("max_latency_ms", 2000))

        if not endpoint:
            return error_response("Endpoint es requerido.", status_code=status.HTTP_400_BAD_REQUEST)

        start = time.perf_counter()
        try:
            if target_type in ("http", "https", "api"):
                url = endpoint if endpoint.startswith(("http://", "https://")) else f"http://{endpoint}"
                headers = {"User-Agent": "Sentinel-Diagnostic/1.0"}
                if isinstance(custom_headers, dict):
                    headers.update(custom_headers)

                resp = requests.request(
                    method=http_method,
                    url=url,
                    headers=headers,
                    data=request_body if request_body else None,
                    timeout=5,
                    verify=False,
                )
                latency = round((time.perf_counter() - start) * 1000, 2)
                code_match = resp.status_code == expected_status
                is_slow = latency > max_latency_ms
                check_status = "up" if code_match and not is_slow else ("slow" if code_match and is_slow else "down")
                return success_response({
                    "status": check_status,
                    "latency_ms": latency,
                    "status_code": resp.status_code,
                    "expected_status": expected_status,
                    "message": f"Respondió HTTP {resp.status_code} en {latency}ms." if code_match else f"Código inesperado: HTTP {resp.status_code} (esperaba {expected_status}).",
                    "headers": dict(resp.headers),
                })
            elif target_type == "tcp":
                host, port = endpoint.split(":") if ":" in endpoint else (endpoint, 80)
                sock = socket.create_connection((host, int(port)), timeout=5)
                sock.close()
                latency = round((time.perf_counter() - start) * 1000, 2)
                return success_response({
                    "status": "slow" if latency > max_latency_ms else "up",
                    "latency_ms": latency,
                    "status_code": 0,
                    "message": f"Conexión TCP establecida con {host}:{port} en {latency}ms.",
                })
            elif target_type == "dns":
                import dns.resolver
                answers = dns.resolver.resolve(endpoint, "A")
                latency = round((time.perf_counter() - start) * 1000, 2)
                ips = [r.to_text() for r in answers]
                return success_response({
                    "status": "up",
                    "latency_ms": latency,
                    "status_code": 0,
                    "message": f"DNS resuelto ({len(ips)} IPs encontradas) en {latency}ms.",
                    "ips": ips,
                })
            else:
                return error_response(f"Tipo {target_type} no soportado para test rápido.", status_code=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            latency = round((time.perf_counter() - start) * 1000, 2)
            return success_response({
                "status": "down",
                "latency_ms": latency,
                "status_code": 0,
                "message": f"Fallo de conexión: {str(exc)}",
            })


class BulkActionView(APIView):
    """Execute bulk operations on multiple targets."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        action = request.data.get("action")
        target_ids = request.data.get("target_ids", [])
        org_id = request.user.organization_id

        if not target_ids or not action:
            return error_response("Acción y target_ids son requeridos.", status_code=status.HTTP_400_BAD_REQUEST)

        targets = MonitoringTarget.objects.filter(id__in=target_ids, organization_id=org_id)
        count = targets.count()

        if action == "pause":
            targets.update(enabled=False)
            msg = f"{count} targets pausados."
        elif action == "resume":
            targets.update(enabled=True)
            msg = f"{count} targets reanudados."
        elif action == "delete":
            targets.delete()
            msg = f"{count} targets eliminados."
        elif action == "scan":
            from .tasks import run_monitoring_check
            for t in targets:
                run_monitoring_check.delay(str(t.id))
            msg = f"Escaneo en segundo plano encolado para {count} targets."
        else:
            return error_response(f"Acción '{action}' inválida.", status_code=status.HTTP_400_BAD_REQUEST)

        return success_response({"message": msg, "affected_count": count})