from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    DomainInfoCreateSerializer,
    DomainInfoSerializer,
)
from .services import DomainService


class DomainListView(APIView):
    """Endpoint for listing and creating domain info records.

    GET /api/v1/domains/
    POST /api/v1/domains/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        domains = DomainService.list_domains(org_id)
        serializer = DomainInfoSerializer(domains, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = DomainInfoCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            domain_info = DomainService.create_domain(
                organization_id=org_id,
                domain=serializer.validated_data["domain"],
            )
            from .tasks import scan_whois
            scan_whois.delay(str(domain_info.id))

            response_serializer = DomainInfoSerializer(domain_info)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class DomainDetailView(APIView):
    """Endpoint for retrieving and deleting a domain info record.

    GET /api/v1/domains/{id}/
    DELETE /api/v1/domains/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            domain_info = DomainService.get_domain(domain_id, org_id)
            serializer = DomainInfoSerializer(domain_info)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Domain not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, domain_id):
        org_id = request.user.organization_id
        domain = request.data.get("domain")
        if not domain:
            return error_response(
                "Domain is required.", status_code=status.HTTP_400_BAD_REQUEST
            )
        try:
            domain_info = DomainService.update_domain_record(
                domain_id, org_id, domain
            )
            from .tasks import scan_whois
            scan_whois.delay(str(domain_info.id))
            serializer = DomainInfoSerializer(domain_info)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            DomainService.delete_domain(domain_id, org_id)
            return success_response({"detail": "Domain deleted."})
        except Exception:
            return error_response(
                "Domain not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class DomainScanView(APIView):
    """Endpoint to trigger manual WHOIS scan.

    POST /api/v1/domains/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            domain_info = DomainService.get_domain(domain_id, org_id)
            from .tasks import scan_whois
            scan_whois(str(domain_info.id))
            updated_domain = DomainService.get_domain(domain_id, org_id)
            serializer = DomainInfoSerializer(updated_domain)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class DomainExpiringSoonView(APIView):
    """Endpoint for domains expiring soon.

    GET /api/v1/domains/expiring/?days=30
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        days = int(request.query_params.get("days", 30))
        domains = DomainService.get_expiring_soon(org_id, days=days)
        serializer = DomainInfoSerializer(domains, many=True)
        return success_response(serializer.data)


class DomainExpiredView(APIView):
    """Endpoint for expired domains.

    GET /api/v1/domains/expired/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        domains = DomainService.get_expired(org_id)
        serializer = DomainInfoSerializer(domains, many=True)
        return success_response(serializer.data)


class DomainStatsView(APIView):
    """Endpoint for WHOIS domain KPI summary statistics.

    GET /api/v1/domains/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = DomainService.get_domain_stats(org_id)
        return success_response(stats_data)


class DomainBulkScanView(APIView):
    """Endpoint to trigger bulk WHOIS scan for all domains.

    POST /api/v1/domains/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import scan_all_domains
            scan_all_domains.delay()
            return success_response({"message": "Consulta WHOIS masiva de dominios iniciada."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class DomainTestWhoisView(APIView):
    """Endpoint to test WHOIS resolution in real-time before saving.

    POST /api/v1/domains/test-whois/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        domain = request.data.get("domain", "").strip()
        if not domain:
            return error_response(
                "El dominio es requerido para la consulta WHOIS.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        result = DomainService.test_whois(domain)
        return success_response(result)


class DomainBulkActionView(APIView):
    """Endpoint to execute bulk actions on monitored domains.

    POST /api/v1/domains/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        action = request.data.get("action")
        domain_ids = request.data.get("domain_ids", [])
        if not action or not domain_ids:
            return error_response(
                "Parámetros 'action' y 'domain_ids' son requeridos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            res = DomainService.bulk_action(org_id, action, domain_ids)
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)