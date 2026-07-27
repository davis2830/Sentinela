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
    """Endpoint for retrieving and deleting an SSL certificate.

    GET /api/v1/ssl-certificates/{id}/
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

    def delete(self, request, certificate_id):
        org_id = request.user.organization_id
        try:
            SSLMonitorService.delete_certificate(certificate_id, org_id)
            return success_response({"detail": "Certificate deleted."})
        except Exception:
            return error_response(
                "Certificate not found.", status_code=status.HTTP_404_NOT_FOUND
            )


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