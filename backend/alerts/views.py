from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    AlertRuleCreateSerializer,
    AlertRuleSerializer,
    AlertRuleUpdateSerializer,
    AlertSerializer,
    AlertUpdateSerializer,
)
from .services import AlertRuleService, AlertService


class AlertRuleListView(APIView):
    """Endpoint for listing and creating alert rules.

    GET /api/v1/alert-rules/
    POST /api/v1/alert-rules/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        rules = AlertRuleService.list_rules(org_id)
        serializer = AlertRuleSerializer(rules, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = AlertRuleCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rule = AlertRuleService.create_rule(
                organization_id=org_id,
                **serializer.validated_data,
            )
            response_serializer = AlertRuleSerializer(rule)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class AlertRuleDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an alert rule.

    GET /api/v1/alert-rules/{id}/
    PATCH /api/v1/alert-rules/{id}/
    DELETE /api/v1/alert-rules/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, rule_id):
        org_id = request.user.organization_id
        try:
            rule = AlertRuleService.get_rule(rule_id, org_id)
            serializer = AlertRuleSerializer(rule)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Alert rule not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, rule_id):
        org_id = request.user.organization_id
        serializer = AlertRuleUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rule = AlertRuleService.update_rule(
                rule_id, org_id, **serializer.validated_data
            )
            response_serializer = AlertRuleSerializer(rule)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Alert rule not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, rule_id):
        org_id = request.user.organization_id
        try:
            AlertRuleService.delete_rule(rule_id, org_id)
            return success_response({"detail": "Alert rule deleted."})
        except Exception:
            return error_response(
                "Alert rule not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class AlertListView(APIView):
    """Endpoint for listing alerts.

    GET /api/v1/alerts/?status=active&severity=critical
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        status_filter = request.query_params.get("status")
        severity_filter = request.query_params.get("severity")
        alerts = AlertService.list_alerts(
            org_id, status_filter=status_filter, severity_filter=severity_filter
        )
        serializer = AlertSerializer(alerts, many=True)
        return success_response(serializer.data)


class AlertDetailView(APIView):
    """Endpoint for retrieving and updating alert status.

    GET /api/v1/alerts/{id}/
    PATCH /api/v1/alerts/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, alert_id):
        org_id = request.user.organization_id
        try:
            alert = AlertService.get_alert(alert_id, org_id)
            serializer = AlertSerializer(alert)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Alert not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, alert_id):
        org_id = request.user.organization_id
        serializer = AlertUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_status = serializer.validated_data["status"]
            if new_status == "acknowledged":
                alert = AlertService.acknowledge_alert(alert_id, org_id)
            elif new_status == "resolved":
                alert = AlertService.resolve_alert(alert_id, org_id)
            else:
                return error_response(
                    "Cannot set status to active manually.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            response_serializer = AlertSerializer(alert)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Alert not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class AlertRuleEvaluateView(APIView):
    """Endpoint for manual on-demand evaluation of all alert rules.

    POST /api/v1/alert-rules/evaluate/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .services import AlertEvaluatorService
            count = AlertEvaluatorService.evaluate_all_rules()
            return success_response({"alerts_created": count, "message": "Evaluación completada."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class AlertBulkAcknowledgeView(APIView):
    """Endpoint for acknowledging all active alerts.

    POST /api/v1/alerts/acknowledge-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        count = AlertService.acknowledge_all(org_id)
        return success_response({"updated": count, "message": f"{count} alertas reconocidas."})


class AlertBulkResolveView(APIView):
    """Endpoint for resolving all active/acknowledged alerts.

    POST /api/v1/alerts/resolve-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        count = AlertService.resolve_all(org_id)
        return success_response({"updated": count, "message": f"{count} alertas resueltas."})


class AlertStatsView(APIView):
    """Endpoint for retrieving alert KPI metrics.

    GET /api/v1/alerts/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats = AlertService.get_alert_stats(org_id)
        return success_response(stats)


class AlertCreateIncidentView(APIView):
    """Endpoint to elevate an alert into an Incident.

    POST /api/v1/alerts/<alert_id>/create-incident/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, alert_id):
        org_id = request.user.organization_id
        try:
            incident = AlertService.create_incident_for_alert(alert_id, org_id)
            from incidents.serializers import IncidentSerializer
            serializer = IncidentSerializer(incident)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)