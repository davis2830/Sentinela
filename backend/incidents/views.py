from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    AddAlertSerializer,
    AddNoteSerializer,
    IncidentAlertSerializer,
    IncidentAssignSerializer,
    IncidentBulkActionSerializer,
    IncidentCreateSerializer,
    IncidentRCASerializer,
    IncidentSerializer,
    IncidentTimelineEventSerializer,
    IncidentUpdateSerializer,
)
from .services import IncidentService


class IncidentStatsView(APIView):
    """Endpoint for retrieving real-time operational incident metrics.

    GET /api/v1/incidents/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        try:
            stats_data = IncidentService.get_stats(org_id)
            return success_response(stats_data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class IncidentBulkActionView(APIView):
    """Endpoint for executing atomic bulk actions on incidents.

    POST /api/v1/incidents/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = IncidentBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Entrada inválida para acción en lote.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        action = data["action"]
        incident_ids = data["incident_ids"]
        actor_name = request.user.get_full_name() or request.user.email

        try:
            res = IncidentService.bulk_action(
                organization_id=org_id,
                action=action,
                incident_ids=incident_ids,
                status=data.get("status"),
                priority=data.get("priority"),
                user_id=data.get("user_id"),
                actor_name=actor_name,
            )
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class IncidentListView(APIView):
    """Endpoint for listing and creating incidents.

    GET /api/v1/incidents/?status=open&priority=critical
    POST /api/v1/incidents/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        status_filter = request.query_params.get("status")
        priority_filter = request.query_params.get("priority")
        incidents = IncidentService.list_incidents(
            org_id, status_filter=status_filter, priority_filter=priority_filter
        )
        serializer = IncidentSerializer(incidents, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = IncidentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Entrada inválida.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            incident = IncidentService.create_incident(
                organization_id=org_id,
                title=serializer.validated_data["title"],
                description=serializer.validated_data.get("description", ""),
                priority=serializer.validated_data.get("priority", "medium"),
                impacted_service=serializer.validated_data.get("impacted_service", ""),
                target_type=serializer.validated_data.get("target_type", ""),
                target_id=serializer.validated_data.get("target_id"),
                assigned_to_id=serializer.validated_data.get("assigned_to"),
                actor_name=actor_name,
            )
            response_serializer = IncidentSerializer(incident)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class IncidentDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an incident.

    GET /api/v1/incidents/{id}/
    PATCH /api/v1/incidents/{id}/
    DELETE /api/v1/incidents/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, incident_id):
        org_id = request.user.organization_id
        try:
            incident = IncidentService.get_incident(incident_id, org_id)
            serializer = IncidentSerializer(incident)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Incidente no encontrado.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = IncidentUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Entrada inválida.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            incident = IncidentService.get_incident(incident_id, org_id)

            if "status" in serializer.validated_data:
                incident = IncidentService.update_status(
                    incident_id, org_id, serializer.validated_data["status"], actor_name=actor_name
                )

            if "priority" in serializer.validated_data:
                incident = IncidentService.update_priority(
                    incident_id, org_id, serializer.validated_data["priority"], actor_name=actor_name
                )

            if "assigned_to" in serializer.validated_data:
                incident = IncidentService.assign_incident(
                    incident_id, org_id, user_id=serializer.validated_data["assigned_to"], actor_name=actor_name
                )

            fields_to_update = []
            if "description" in serializer.validated_data:
                incident.description = serializer.validated_data["description"]
                fields_to_update.append("description")

            if "impacted_service" in serializer.validated_data:
                incident.impacted_service = serializer.validated_data["impacted_service"]
                fields_to_update.append("impacted_service")

            if "root_cause" in serializer.validated_data:
                incident.root_cause = serializer.validated_data["root_cause"]
                fields_to_update.append("root_cause")

            if "resolution_summary" in serializer.validated_data:
                incident.resolution_summary = serializer.validated_data["resolution_summary"]
                fields_to_update.append("resolution_summary")

            if "preventive_actions" in serializer.validated_data:
                incident.preventive_actions = serializer.validated_data["preventive_actions"]
                fields_to_update.append("preventive_actions")

            if fields_to_update:
                incident.save(update_fields=fields_to_update)

            response_serializer = IncidentSerializer(incident)
            return success_response(response_serializer.data)
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, incident_id):
        org_id = request.user.organization_id
        try:
            IncidentService.delete_incident(incident_id, org_id)
            return success_response({"detail": "Incidente eliminado."})
        except Exception:
            return error_response(
                "Incidente no encontrado.", status_code=status.HTTP_404_NOT_FOUND
            )


class IncidentRCAView(APIView):
    """Endpoint for updating RCA and post-mortem notes.

    POST /api/v1/incidents/{id}/rca/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = IncidentRCASerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Datos de RCA inválidos.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            incident = IncidentService.update_rca(
                incident_id=incident_id,
                organization_id=org_id,
                root_cause=serializer.validated_data["root_cause"],
                resolution_summary=serializer.validated_data.get("resolution_summary", ""),
                preventive_actions=serializer.validated_data.get("preventive_actions", ""),
                actor_name=actor_name,
            )
            response_serializer = IncidentSerializer(incident)
            return success_response(response_serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class IncidentAssignView(APIView):
    """Endpoint for assigning an incident to a user.

    POST /api/v1/incidents/{id}/assign/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = IncidentAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Datos de asignación inválidos.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            incident = IncidentService.assign_incident(
                incident_id=incident_id,
                organization_id=org_id,
                user_id=serializer.validated_data.get("user_id"),
                actor_name=actor_name,
            )
            response_serializer = IncidentSerializer(incident)
            return success_response(response_serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class IncidentTimelineView(APIView):
    """Endpoint for listing timeline events and adding collaborative notes.

    GET /api/v1/incidents/{id}/timeline/
    POST /api/v1/incidents/{id}/timeline/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, incident_id):
        org_id = request.user.organization_id
        try:
            timeline = IncidentService.get_timeline(incident_id, org_id)
            serializer = IncidentTimelineEventSerializer(timeline, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Incidente no encontrado.", status_code=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = AddNoteSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Entrada inválida.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            event = IncidentService.add_note(
                incident_id, org_id, serializer.validated_data["note"], actor_name=actor_name
            )
            response_serializer = IncidentTimelineEventSerializer(event)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class IncidentAlertsView(APIView):
    """Endpoint for listing and linking alerts to an incident.

    GET /api/v1/incidents/{id}/alerts/
    POST /api/v1/incidents/{id}/alerts/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, incident_id):
        org_id = request.user.organization_id
        try:
            alerts = IncidentService.get_linked_alerts(incident_id, org_id)
            serializer = IncidentAlertSerializer(alerts, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Incidente no encontrado.", status_code=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = AddAlertSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Entrada inválida.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        actor_name = request.user.get_full_name() or request.user.email

        try:
            incident_alert = IncidentService.add_alert(
                incident_id, serializer.validated_data["alert_id"], actor_name=actor_name
            )
            response_serializer = IncidentAlertSerializer(incident_alert)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)