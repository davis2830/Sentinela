from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    SSLCertificateCreateSerializer,
    SSLCertificateSerializer,
)
from .services import SSLMonitorService


class SSLCertificateListView(APIView):
    """Endpoint for listing and creating SSL certificates.

    GET /api/v1/ssl-certificates/
    POST /api/v1/ssl-certificates/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        certificates = SSLMonitorService.list_certificates(org_id)
        serializer = SSLCertificateSerializer(certificates, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = SSLCertificateCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cert = SSLMonitorService.create_certificate(
                organization_id=org_id,
                domain=serializer.validated_data["domain"],
                port=serializer.validated_data.get("port", 443),
            )
            from .tasks import scan_ssl_certificate
            scan_ssl_certificate.delay(str(cert.id))

            response_serializer = SSLCertificateSerializer(cert)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class SSLCertificateDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an SSL certificate.

    GET /api/v1/ssl-certificates/{id}/
    PATCH /api/v1/ssl-certificates/{id}/
    DELETE /api/v1/ssl-certificates/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, certificate_id):
        org_id = request.user.organization_id
        try:
            cert = SSLMonitorService.get_certificate(certificate_id, org_id)
            serializer = SSLCertificateSerializer(cert)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Certificate not found.", status_code=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, certificate_id):
        org_id = request.user.organization_id
        domain = request.data.get("domain")
        port = request.data.get("port", 443)
        if not domain:
            return error_response(
                "Domain is required.", status_code=status.HTTP_400_BAD_REQUEST
            )
        try:
            cert = SSLMonitorService.update_certificate_domain(
                certificate_id, org_id, domain, port=port
            )
            from .tasks import scan_ssl_certificate
            scan_ssl_certificate.delay(str(cert.id))
            serializer = SSLCertificateSerializer(cert)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, certificate_id):
        org_id = request.user.organization_id
        try:
            SSLMonitorService.delete_certificate(certificate_id, org_id)
            return success_response({"detail": "Certificate deleted."})
        except Exception:
            return error_response(
                "Certificate not found.", status_code=status.HTTP_404_NOT_FOUND
            )


class SSLCertificateScanView(APIView):
    """Endpoint to trigger manual SSL scan.

    POST /api/v1/ssl-certificates/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, certificate_id):
        org_id = request.user.organization_id
        try:
            cert = SSLMonitorService.get_certificate(certificate_id, org_id)
            from .tasks import scan_ssl_certificate
            scan_ssl_certificate(str(cert.id))
            updated_cert = SSLMonitorService.get_certificate(certificate_id, org_id)
            serializer = SSLCertificateSerializer(updated_cert)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SSLExpiringSoonView(APIView):
    """Endpoint for certificates expiring soon.

    GET /api/v1/ssl-certificates/expiring/?days=15
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        days = int(request.query_params.get("days", 15))
        certs = SSLMonitorService.get_expiring_soon(org_id, days=days)
        serializer = SSLCertificateSerializer(certs, many=True)
        return success_response(serializer.data)


class SSLExpiredView(APIView):
    """Endpoint for expired certificates.

    GET /api/v1/ssl-certificates/expired/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        certs = SSLMonitorService.get_expired(org_id)
        serializer = SSLCertificateSerializer(certs, many=True)
        return success_response(serializer.data)


class SSLStatsView(APIView):
    """Endpoint for SSL certificate KPI summary statistics.

    GET /api/v1/ssl-certificates/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = SSLMonitorService.get_certificate_stats(org_id)
        return success_response(stats_data)


class SSLBulkScanView(APIView):
    """Endpoint to trigger bulk scan for all certificates.

    POST /api/v1/ssl-certificates/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import scan_all_certificates
            scan_all_certificates.delay()
            return success_response({"message": "Re-escaneo masivo de certificados iniciado."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SSLTestConnectionView(APIView):
    """Endpoint to test SSL connection in real-time before saving.

    POST /api/v1/ssl-certificates/test-connection/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        domain = request.data.get("domain", "").strip()
        port = request.data.get("port", 443)
        if not domain:
            return error_response(
                "El dominio es requerido para la prueba.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        result = SSLMonitorService.test_connection(domain, port=port)
        return success_response(result)


class SSLBulkActionView(APIView):
    """Endpoint to execute bulk actions on certificates.

    POST /api/v1/ssl-certificates/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        action = request.data.get("action")
        certificate_ids = request.data.get("certificate_ids", [])
        if not action or not certificate_ids:
            return error_response(
                "Parámetros 'action' y 'certificate_ids' son requeridos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            res = SSLMonitorService.bulk_action(org_id, action, certificate_ids)
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)