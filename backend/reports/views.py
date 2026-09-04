from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    ReportBulkActionSerializer,
    ReportCreateSerializer,
    ReportSerializer,
)
from .services import ReportExporter, ReportService


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
            params = dict(serializer.validated_data.get("parameters") or {})
            if "target_ids" in serializer.validated_data and serializer.validated_data["target_ids"]:
                params["target_ids"] = [str(tid) for tid in serializer.validated_data["target_ids"]]
            if "sla_target" in serializer.validated_data:
                params["sla_target"] = serializer.validated_data["sla_target"]

            report = ReportService.create_report(
                organization_id=org_id,
                report_type=serializer.validated_data["report_type"],
                title=serializer.validated_data["title"],
                parameters=params,
                period_start=serializer.validated_data.get("period_start"),
                period_end=serializer.validated_data.get("period_end"),
            )

            response_serializer = ReportSerializer(report)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class ReportLiveSLAMetricsView(APIView):
    """Endpoint for live SLA and Error Budget telemetry.

    GET /api/v1/reports/sla-live/?days=30&target_sla=99.9
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        days = request.query_params.get("days", 30)
        target_sla = request.query_params.get("target_sla", 99.9)

        try:
            days = int(days)
            target_sla = float(target_sla)
        except (ValueError, TypeError):
            days = 30
            target_sla = 99.9

        try:
            metrics = ReportService.get_live_sla_metrics(
                organization_id=org_id, target_sla=target_sla, days=days
            )
            return success_response(metrics)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class ReportBulkActionView(APIView):
    """Endpoint for bulk operations on reports.

    POST /api/v1/reports/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = ReportBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        action = serializer.validated_data["action"]
        report_ids = serializer.validated_data["report_ids"]

        try:
            result = ReportService.bulk_action(org_id, action, report_ids)
            return success_response(result)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


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


def _get_authenticated_user(request):
    if request.user and request.user.is_authenticated:
        return request.user
    token = request.query_params.get("token")
    if token:
        from rest_framework_simplejwt.tokens import AccessToken
        from users.models import User
        try:
            validated = AccessToken(token)
            user_id = validated.get("user_id")
            return User.objects.get(id=user_id)
        except Exception:
            pass
    return None


class ReportExportCSVView(APIView):
    """Endpoint for exporting a report to CSV format."""

    permission_classes = ()

    def get(self, request, report_id):
        user = _get_authenticated_user(request)
        if not user or not user.organization_id:
            return error_response("Authentication credentials were not provided.", status_code=status.HTTP_401_UNAUTHORIZED)
        org_id = user.organization_id
        try:
            report = ReportService.get_report(report_id, org_id)
            csv_content, filename = ReportExporter.export_csv(report)

            response = HttpResponse(csv_content, content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_404_NOT_FOUND)


class ReportExportPDFView(APIView):
    """Endpoint for exporting an executive PDF/HTML report document."""

    permission_classes = ()

    def get(self, request, report_id):
        user = _get_authenticated_user(request)
        if not user or not user.organization_id:
            return error_response("Authentication credentials were not provided.", status_code=status.HTTP_401_UNAUTHORIZED)
        org_id = user.organization_id
        try:
            report = ReportService.get_report(report_id, org_id)
            html_content, filename = ReportExporter.export_html_pdf(report)

            response = HttpResponse(html_content, content_type="text/html; charset=utf-8")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_404_NOT_FOUND)