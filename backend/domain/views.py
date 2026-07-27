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

    def delete(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            DomainService.delete_domain(domain_id, org_id)
            return success_response({"detail": "Domain deleted."})
        except Exception:
            return error_response(
                "Domain not found.", status_code=status.HTTP_404_NOT_FOUND
            )


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