from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    AddAlertSerializer,
    AddNoteSerializer,
    IncidentAlertSerializer,
    IncidentCreateSerializer,
    IncidentSerializer,
    IncidentTimelineEventSerializer,
    IncidentUpdateSerializer,
)
from .services import IncidentService


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
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            incident = IncidentService.create_incident(
                organization_id=org_id,
                title=serializer.validated_data["title"],
                description=serializer.validated_data.get("description", ""),
                priority=serializer.validated_data.get("priority", "medium"),
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
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = IncidentUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            incident = IncidentService.get_incident(incident_id, org_id)

            if "status" in serializer.validated_data:
                incident = IncidentService.update_status(
                    incident_id, org_id, serializer.validated_data["status"]
                )

            if "priority" in serializer.validated_data:
                incident = IncidentService.update_priority(
                    incident_id, org_id, serializer.validated_data["priority"]
                )

            if "description" in serializer.validated_data:
                incident.description = serializer.validated_data["description"]
                incident.save(update_fields=["description"])

            response_serializer = IncidentSerializer(incident)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, incident_id):
        org_id = request.user.organization_id
        try:
            IncidentService.delete_incident(incident_id, org_id)
            return success_response({"detail": "Incident deleted."})
        except Exception:
            return error_response(
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class IncidentTimelineView(APIView):
    """Endpoint for listing timeline events and adding notes.

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
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = AddNoteSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            event = IncidentService.add_note(
                incident_id, org_id, serializer.validated_data["note"]
            )
            response_serializer = IncidentTimelineEventSerializer(event)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception:
            return error_response(
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )


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
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, incident_id):
        org_id = request.user.organization_id
        serializer = AddAlertSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            incident_alert = IncidentService.add_alert(
                incident_id, serializer.validated_data["alert_id"]
            )
            response_serializer = IncidentAlertSerializer(incident_alert)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception:
            return error_response(
                "Incident not found.", status_code=status.HTTP_404_NOT_FOUND
            )