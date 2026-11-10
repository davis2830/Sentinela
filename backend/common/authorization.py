"""Explicit operational capabilities. Tenant, token scope and quotas remain independent."""

from collections.abc import Mapping
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView

MODULES = {
    "monitoring": "Monitoreo",
    "ssl_monitor": "SSL",
    "dns_monitor": "DNS",
    "domain": "Dominios",
    "api_checks": "API Checks",
    "security_headers": "Security Headers",
    "alerts": "Alertas",
    "notifications": "Notificaciones",
    "incidents": "Incidentes",
    "maintenance": "Mantenimientos",
    "reports": "Reportes",
    "status_page": "Status Page",
}
ACTIONS = {
    "read": "Consultar",
    "create": "Crear",
    "update": "Modificar",
    "delete": "Eliminar",
    "scan": "Escanear",
    "acknowledge": "Reconocer",
    "resolve": "Resolver",
    "snooze": "Posponer",
    "simulate": "Simular",
    "evaluate": "Evaluar",
    "send": "Enviar",
    "retry": "Reintentar",
    "test": "Probar",
    "start": "Iniciar",
    "complete": "Completar",
    "cancel": "Cancelar",
}
# Only listed handlers receive CRUD defaults. New handlers fail closed for custom users.
HANDLERS = {
    "monitoring": "TestConnectionView MonitoringTargetListView MonitoringTargetDetailView MonitoringCheckListView MonitoringUptimeView MonitoringTimeseriesView MonitoringGlobalPerformanceView MonitoringTargetScanView GlobalSearchView MonitoringTargetBulkScanView MonitoringTargetExportView MaintenanceWindowListView MaintenanceWindowDetailView BulkActionView TargetCoverageView",
    "ssl_monitor": "SSLTestConnectionView SSLCertificateListView SSLCertificateDetailView SSLCertificateScanView SSLExpiringSoonView SSLExpiredView SSLStatsView SSLBulkScanView SSLBulkActionView",
    "dns_monitor": "DNSTestResolutionView DNSRecordListView DNSRecordDetailView DNSRecordScanView DNSChangeHistoryView DNSDomainsView DNSStatsView DNSBulkScanView DNSBulkActionView",
    "domain": "DomainTestWhoisView DomainListView DomainDetailView DomainScanView DomainExpiringSoonView DomainExpiredView DomainStatsView DomainBulkScanView DomainBulkActionView",
    "api_checks": "APICheckTestRequestView APICheckTargetListView APICheckTargetDetailView APICheckTargetScanView APICheckResultListView APICheckStatsView APICheckBulkScanView APICheckBulkActionView",
    "security_headers": "SecurityHeaderTestView SecurityHeaderTargetListView SecurityHeaderTargetDetailView SecurityHeaderTargetScanView SecurityHeaderResultListView SecurityHeaderStatsView SecurityHeaderBulkScanView SecurityHeaderBulkActionView",
    "alerts": "AlertRuleListView AlertRuleDetailView AlertRuleSimulateView AlertRuleSnoozeView AlertRuleEvaluateView AlertListView AlertDetailView AlertSnoozeView AlertBulkAcknowledgeView AlertBulkResolveView AlertBulkActionView AlertStatsView AlertCreateIncidentView",
    "notifications": "NotificationChannelListView NotificationChannelDetailView NotificationChannelBulkActionView NotificationListView NotificationDetailView NotificationRetryView NotificationChannelTestView NotificationTestConnectionView NotificationStatsView NotificationExportCsvView",
    "incidents": "IncidentStatsView IncidentBulkActionView IncidentListView IncidentDetailView IncidentRCAView IncidentAssignView IncidentTimelineView IncidentAlertsView",
    "maintenance": "MaintenanceWindowStatsView MaintenanceWindowBulkActionView MaintenanceWindowListView MaintenanceWindowDetailView MaintenanceWindowStartView MaintenanceWindowCompleteView MaintenanceWindowCancelView MaintenanceWindowProgressUpdateView",
    "reports": "ReportListView ReportLiveSLAMetricsView ReportBulkActionView ReportDetailView ReportExportCSVView ReportExportPDFView",
    "status_page": "StatusPageListView StatusPageDetailView StatusPageSetDefaultView StatusPageConfigView StatusPageStatsView StatusPageAvailableTargetsView MaintenanceListView MaintenanceBulkActionView MaintenanceDetailView MaintenanceUpdateView SubscriberListView SubscriberDeleteView SubscriberExportCSVView",
}
SPECIAL = {
    "SecurityHeaderTestView": "test",
    "APICheckTestRequestView": "test",
    "DomainTestWhoisView": "test",
    "DNSTestResolutionView": "test",
    "SSLTestConnectionView": "test",
    "TestConnectionView": "test",
    "AlertRuleSimulateView": "simulate",
    "AlertRuleSnoozeView": "snooze",
    "AlertRuleEvaluateView": "evaluate",
    "AlertSnoozeView": "snooze",
    "AlertBulkAcknowledgeView": "acknowledge",
    "AlertBulkResolveView": "resolve",
    "NotificationRetryView": "retry",
    "NotificationChannelTestView": "test",
    "NotificationTestConnectionView": "test",
    "MaintenanceWindowStartView": "start",
    "MaintenanceWindowCompleteView": "complete",
    "MaintenanceWindowCancelView": "cancel",
}
BULK = {
    "pause": "update",
    "resume": "update",
    "enable": "update",
    "disable": "update",
    "delete": "delete",
    "scan": "scan",
    "acknowledge": "acknowledge",
    "resolve": "resolve",
    "snooze": "snooze",
    "start": "start",
    "complete": "complete",
    "cancel": "cancel",
    "update_status": "update",
    "update_priority": "update",
    "assign": "update",
    "status": "update",
    "priority": "update",
    "test": "test",
    "completed": "update",
    "in_progress": "update",
    "scheduled": "update",
    "cancelled": "update",
}
PUBLIC_HANDLERS = {
    "AgentProbeHeartbeatView",
    "AgentProbeSubmitResultsView",
    "PublicStatusPageView",
    "PublicSubscribeView",
    "PublicUnsubscribeView",
}


MODULE_ACTIONS = {
    **{
        module: ("read", "create", "update", "delete", "scan", "test")
        for module in ("monitoring", "ssl_monitor", "dns_monitor", "domain", "api_checks", "security_headers")
    },
    "alerts": ("read", "create", "update", "delete", "acknowledge", "resolve", "snooze", "simulate", "evaluate"),
    "notifications": ("read", "create", "update", "delete", "send", "retry", "test"),
    "incidents": ("read", "create", "update", "delete", "resolve"),
    "maintenance": ("read", "create", "update", "delete", "start", "complete", "cancel"),
    "reports": ("read", "create", "delete"),
    "status_page": ("read", "create", "update", "delete", "start", "complete", "cancel"),
}


def catalog():
    return [
        {"code": f"{module}.{action}", "name": f"{label}: {verb}", "module": module}
        for module, label in MODULES.items()
        for action in MODULE_ACTIONS[module]
        for verb in [ACTIONS[action]]
    ]


def effective_permissions(user, *, mode=None):
    if not user.is_active or not user.organization_id:
        return []
    if user.is_staff or user.is_superuser:
        return [item["code"] for item in catalog()]
    if (mode or user.authorization_mode) == "legacy":
        return [f"{module}.read" for module in MODULES]
    from users.models import Permission

    allowed = {item["code"] for item in catalog()}
    return sorted(
        set(
            Permission.objects.filter(
                roles__user_roles__user=user, roles__organization_id=user.organization_id
            ).values_list("code", flat=True)
        )
        & allowed
    )


def required_permissions(request, view):
    module = type(view).__module__.split(".")[0]
    name = type(view).__name__
    if name not in HANDLERS.get(module, "").split():
        return None
    if module == "monitoring" and name in ("MaintenanceWindowListView", "MaintenanceWindowDetailView"):
        module = "maintenance"
    if request.method in SAFE_METHODS:
        if name == "GlobalSearchView":
            return [
                f"{item}.read"
                for item in ("monitoring", "ssl_monitor", "dns_monitor", "api_checks", "alerts", "incidents")
            ]
        return [f"{module}.read"]
    action = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}.get(request.method)
    if name.endswith(("BulkActionView",)) or name == "BulkActionView":
        action = BULK.get(request.data.get("action"))
    elif "ScanView" in name:
        action = "scan"
    elif name in SPECIAL:
        action = SPECIAL[name]
    elif name == "NotificationListView":
        action = "send"
    elif name == "AlertDetailView":
        # Status transitions must not bypass their dedicated capabilities.
        status = request.data.get("status")
        action = {"acknowledged": "acknowledge", "resolved": "resolve"}.get(status, "update")
    elif name in {
        "IncidentAssignView",
        "IncidentRCAView",
        "IncidentTimelineView",
        "IncidentAlertsView",
        "StatusPageSetDefaultView",
        "MaintenanceUpdateView",
        "MaintenanceWindowProgressUpdateView",
    }:
        action = "update"
    if module in ("status_page", "maintenance") and name in (
        "MaintenanceBulkActionView",
        "MaintenanceDetailView",
        "MaintenanceUpdateView",
        "MaintenanceWindowDetailView",
        "MaintenanceWindowListView",
        "MaintenanceWindowProgressUpdateView",
    ):
        state = request.data.get("action") if name == "MaintenanceBulkActionView" else request.data.get("status")
        action = {"completed": "complete", "cancelled": "cancel", "in_progress": "start"}.get(str(state), action)
    if not action:
        return None
    transition = None
    if (
        module == "incidents"
        and request.data.get("status") in ("resolved", "closed")
        and request.method in ("PATCH", "POST")
    ):
        transition = "resolve"
        if name in ("IncidentDetailView", "IncidentBulkActionView"):
            action = "resolve"
    if module == "monitoring" and name in ("MaintenanceWindowListView", "MaintenanceWindowDetailView"):
        module = "maintenance"
    result = [f"{module}.{action}"]
    if transition:
        result.append(f"{module}.{transition}")
    # Creating an object in a terminal/active state also requires the creation capability.
    if request.method == "POST" and name in ("MaintenanceListView", "MaintenanceWindowListView"):
        result.append(f"{module}.create")
    if module in ("maintenance", "status_page") and request.data.get("status") in (
        "in_progress",
        "completed",
        "cancelled",
    ):
        state_action = {"in_progress": "start", "completed": "complete", "cancelled": "cancel"}[request.data["status"]]
        result.append(f"{module}.{state_action}")
    if name == "IncidentDetailView" and transition and set(request.data) - {"status"}:
        result.append("incidents.update")
    if name == "AlertCreateIncidentView":
        result = ["alerts.update", "incidents.create"]
    return result + related_permissions(request, view)


RELATED_MODULES = {
    "ssl": "ssl_monitor",
    "dns": "dns_monitor",
    "domain": "domain",
    "security": "security_headers",
    "api": "api_checks",
}


def uses_custom_permissions(user):
    return not (user.is_staff or user.is_superuser) and user.authorization_mode == "custom"


def related_permissions(request, view):
    name = type(view).__name__
    module = type(view).__module__.split(".")[0]
    result = []
    if module == "monitoring" and name == "MonitoringTargetListView" and request.method == "POST":
        selected = request.data.get("related_modules", [])
        if isinstance(selected, list):
            result += [RELATED_MODULES.get(str(item), "unknown") + ".create" for item in selected]
    if module == "monitoring" and name == "TargetCoverageView":
        result += [RELATED_MODULES.get(item, "unknown") + ".read" for item in request.data]
    if module == "maintenance" and request.data.get("publish_to_status_page"):
        result += ["status_page.create", "status_page.read"]
    if module == "status_page":
        kinds = {
            "uptime": "monitoring",
            "monitoring": "monitoring",
            "api": "api_checks",
            "api_check": "api_checks",
            "ssl": "ssl_monitor",
            "dns": "dns_monitor",
        }
        components = request.data.get("component_settings", [])
        if isinstance(components, list):
            result += [
                kinds.get(str(item.get("target_type", "uptime")), "unknown") + ".read"
                for item in components
                if isinstance(item, dict)
            ]
        if request.data.get("clone_from_page_id"):
            result.append("status_page.read")
        ids = request.data.get("monitored_targets", [])
        if isinstance(ids, list) and ids:
            from monitoring.models import MonitoringTarget
            from api_checks.models import APICheckTarget
            from rest_framework import serializers

            validated = [serializers.UUIDField().run_validation(pk) for pk in ids]
            for model, capability in ((MonitoringTarget, "monitoring.read"), (APICheckTarget, "api_checks.read")):
                if model.objects.filter(organization_id=request.user.organization_id, pk__in=validated).exists():
                    result.append(capability)
    return result


def operational_access(request, view):
    user = request.user
    if user.is_staff or user.is_superuser:
        return True
    if user.authorization_mode == "legacy":
        return request.method in SAFE_METHODS
    required = required_permissions(request, view)
    if not hasattr(request, "_operational_capabilities"):
        request._operational_capabilities = set(effective_permissions(user))
    return required is not None and set(required).issubset(request._operational_capabilities)


class AuthorizedAPIView(APIView):
    def check_permissions(self, request):
        if (
            request.user.is_authenticated
            and type(self).__module__.split(".")[0] in MODULES
            and request.method not in SAFE_METHODS
            and not isinstance(request.data, Mapping)
        ):
            raise ValidationError("Se esperaba un objeto JSON.")
        super().check_permissions(request)
        if not request.user.is_authenticated or type(self).__name__ in PUBLIC_HANDLERS:
            return
        module = type(self).__module__.split(".")[0]
        if module in MODULES and not operational_access(request, self):
            raise PermissionDenied("No tienes permiso para esta operación.")
