from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    ReportCreateSerializer,
    ReportSerializer,
)
from .services import ReportService


class ReportListView(APIView):
    """Endpoint for listing and creating reports.

    GET /api/v1/reports/?type=sla
    POST /api/v1/reports/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        report_type = request.query_params.get("type")
        reports = ReportService.list_reports(org_id, report_type=report_type)
        serializer = ReportSerializer(reports, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = ReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            report = ReportService.create_report(
                organization_id=org_id,
                report_type=serializer.validated_data["report_type"],
                title=serializer.validated_data["title"],
                parameters=serializer.validated_data.get("parameters"),
                period_start=serializer.validated_data.get("period_start"),
                period_end=serializer.validated_data.get("period_end"),
            )
            from .tasks import generate_report_task
            generate_report_task.delay(str(report.id))

            response_serializer = ReportSerializer(report)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class ReportDetailView(APIView):
    """Endpoint for retrieving and deleting a report.

    GET /api/v1/reports/{id}/
    DELETE /api/v1/reports/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, report_id):
        org_id = request.user.organization_id
        try:
            report = ReportService.get_report(report_id, org_id)
            serializer = ReportSerializer(report)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Report not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, report_id):
        org_id = request.user.organization_id
        try:
            ReportService.delete_report(report_id, org_id)
            return success_response({"detail": "Report deleted."})
        except Exception:
            return error_response(
                "Report not found.", status_code=status.HTTP_404_NOT_FOUND
            )