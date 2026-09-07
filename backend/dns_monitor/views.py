from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    DNSChangeHistorySerializer,
    DNSRecordCreateSerializer,
    DNSRecordSerializer,
)
from .services import DNSMonitorService


class DNSRecordListView(APIView):
    """Endpoint for listing and creating DNS records.

    GET /api/v1/dns-records/
    POST /api/v1/dns-records/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        domain = request.query_params.get("domain")
        records = DNSMonitorService.list_records(org_id, domain=domain)
        serializer = DNSRecordSerializer(records, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = DNSRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            record = DNSMonitorService.create_record(
                organization_id=org_id,
                domain=serializer.validated_data["domain"],
                record_type=serializer.validated_data["record_type"],
            )
            from .tasks import scan_dns_records
            scan_dns_records.delay(str(record.id))

            response_serializer = DNSRecordSerializer(record)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class DNSRecordDetailView(APIView):
    """Endpoint for retrieving and deleting a DNS record.

    GET /api/v1/dns-records/{id}/
    DELETE /api/v1/dns-records/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, record_id):
        org_id = request.user.organization_id
        try:
            record = DNSMonitorService.get_record(record_id, org_id)
            serializer = DNSRecordSerializer(record)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "DNS record not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, record_id):
        org_id = request.user.organization_id
        domain = request.data.get("domain")
        record_type = request.data.get("record_type")
        try:
            record = DNSMonitorService.update_record(
                record_id, org_id, domain=domain, record_type=record_type
            )
            from .tasks import scan_dns_records
            scan_dns_records.delay(str(record.id))
            serializer = DNSRecordSerializer(record)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, record_id):
        org_id = request.user.organization_id
        try:
            DNSMonitorService.delete_record(record_id, org_id)
            return success_response({"detail": "DNS record deleted."})
        except Exception:
            return error_response(
                "DNS record not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class DNSRecordScanView(APIView):
    """Endpoint to trigger manual DNS scan.

    POST /api/v1/dns-records/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, record_id):
        org_id = request.user.organization_id
        try:
            record = DNSMonitorService.get_record(record_id, org_id)
            from .tasks import scan_dns_records
            scan_dns_records(str(record.id))
            updated_record = DNSMonitorService.get_record(record_id, org_id)
            serializer = DNSRecordSerializer(updated_record)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class DNSChangeHistoryView(APIView):
    """Endpoint for listing change history of a DNS record.

    GET /api/v1/dns-records/{id}/history/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, record_id):
        org_id = request.user.organization_id
        limit = int(request.query_params.get("limit", 50))
        try:
            history = DNSMonitorService.get_change_history(
                record_id, org_id, limit=limit
            )
            serializer = DNSChangeHistorySerializer(history, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "DNS record not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class DNSDomainsView(APIView):
    """Endpoint for listing unique monitored domains.

    GET /api/v1/dns-records/domains/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        domains = DNSMonitorService.get_domains(org_id)
        return success_response({"domains": list(domains)})


class DNSStatsView(APIView):
    """Endpoint for DNS record KPI summary statistics.

    GET /api/v1/dns-records/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = DNSMonitorService.get_dns_stats(org_id)
        return success_response(stats_data)


class DNSBulkScanView(APIView):
    """Endpoint to trigger bulk resolution for all DNS records.

    POST /api/v1/dns-records/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import scan_all_dns_records
            scan_all_dns_records.delay()
            return success_response({"message": "Re-resolución masiva de registros DNS iniciada."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class DNSTestResolutionView(APIView):
    """Endpoint to test DNS query resolution in real-time before saving.

    POST /api/v1/dns-records/test-resolution/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        domain = request.data.get("domain", "").strip()
        record_type = request.data.get("record_type", "A").strip().upper()
        if not domain:
            return error_response(
                "El dominio es requerido para la consulta DNS.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        result = DNSMonitorService.test_resolution(domain, record_type=record_type)
        return success_response(result)


class DNSBulkActionView(APIView):
    """Endpoint to execute bulk actions on DNS records.

    POST /api/v1/dns-records/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        action = request.data.get("action")
        record_ids = request.data.get("record_ids", [])
        if not action or not record_ids:
            return error_response(
                "Parámetros 'action' y 'record_ids' son requeridos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            res = DNSMonitorService.bulk_action(org_id, action, record_ids)
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)