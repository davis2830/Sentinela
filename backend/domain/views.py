from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from rest_framework.exceptions import APIException
from rest_framework import status
from common.scan_limits import enqueue_scan, enqueue_many, ScanLimited, limited_response
from rest_framework.permissions import IsAuthenticated
from common.subscriptions import OperationalAPIView as APIView
from common.diagnostics import ConfigurationDiagnosticAPIView

from common.responses import error_response, queued_scan_response, success_response

from .serializers import (
    DomainChangeHistorySerializer,
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
        from common.connectivity_directory import directory

        return directory(domains, request, DomainInfoSerializer, "domain")

    def post(self, request):
        org_id = request.user.organization_id
        serializer = DomainInfoCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce quota limits
        if getattr(request.user, "organization", None):
            try:
                from organizations.services import QuotaExceededException

            except QuotaExceededException as qe:
                return error_response(
                    str(qe),
                    errors={
                        "code": "QUOTA_EXCEEDED",
                        "resource": qe.resource_type,
                        "limit": qe.limit,
                        "plan": qe.plan_tier,
                    },
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        try:
            domain_info = DomainService.create_domain(
                organization_id=org_id,
                domain=serializer.validated_data["domain"],
                manual_expiration_date=serializer.validated_data.get("manual_expiration_date"),
            )

            response_serializer = DomainInfoSerializer(domain_info, context={"request": request})
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except (ValueError, ObjectDoesNotExist, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)


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
            serializer = DomainInfoSerializer(domain_info, context={"request": request})
            return success_response(serializer.data)
        except ObjectDoesNotExist:
            return error_response("Domain not found.", status_code=status.HTTP_404_NOT_FOUND)

    def patch(self, request, domain_id):
        org_id = request.user.organization_id
        domain = request.data.get("domain")
        has_manual = "manual_expiration_date" in request.data
        manual_val = request.data.get("manual_expiration_date") if has_manual else ...
        if not domain and not has_manual:
            return error_response(
                "Domain or manual_expiration_date is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            domain_info = DomainService.update_domain_record(
                domain_id,
                org_id,
                domain=domain,
                manual_expiration_date=manual_val,
            )
            serializer = DomainInfoSerializer(domain_info, context={"request": request})
            return success_response(serializer.data)
        except (ValueError, ObjectDoesNotExist, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            DomainService.delete_domain(domain_id, org_id)
            return success_response({"detail": "Domain deleted."})
        except ObjectDoesNotExist:
            return error_response("Domain not found.", status_code=status.HTTP_404_NOT_FOUND)


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

            task = enqueue_scan(domain_info, scan_whois)
            return queued_scan_response(task, domain_info.id)
        except ScanLimited as exc:
            return limited_response(exc)
        except (ValueError, ObjectDoesNotExist, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)


class DomainExpiringSoonView(APIView):
    """Endpoint for domains expiring soon.

    GET /api/v1/domains/expiring/?days=30
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        days = int(request.query_params.get("days", 30))
        domains = DomainService.get_expiring_soon(org_id, days=days)
        serializer = DomainInfoSerializer(domains, many=True, context={"request": request})
        return success_response(serializer.data)


class DomainExpiredView(APIView):
    """Endpoint for expired domains.

    GET /api/v1/domains/expired/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        domains = DomainService.get_expired(org_id)
        serializer = DomainInfoSerializer(domains, many=True, context={"request": request})
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
            from .tasks import scan_whois
            from .models import DomainInfo

            return success_response(
                enqueue_many(
                    DomainInfo.objects.filter(organization_id=request.user.organization_id), scan_whois, report=True
                )
            )
        except (ValueError, ObjectDoesNotExist, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)


class DomainTestWhoisView(ConfigurationDiagnosticAPIView):
    """Endpoint to test WHOIS resolution in real-time before saving.

    POST /api/v1/domains/test-whois/
    """

    permission_classes = (IsAuthenticated,)

    def perform_diagnostic(self, request):
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
        except (ValueError, ObjectDoesNotExist, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)


class DomainAcknowledgeChangesView(APIView):
    """Acknowledge reviewed domain registration changes (NS, registrar, transfer lock).

    POST /api/v1/domains/{id}/acknowledge-changes/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, domain_id):
        org_id = request.user.organization_id
        try:
            domain_info = DomainService.acknowledge_changes(domain_id, org_id)
            serializer = DomainInfoSerializer(domain_info, context={"request": request})
            return success_response(serializer.data)
        except ObjectDoesNotExist:
            return error_response("Domain not found.", status_code=status.HTTP_404_NOT_FOUND)
        except (ValueError, APIException, DjangoValidationError) as exc:
            return error_response(exc, status_code=status.HTTP_400_BAD_REQUEST)


class DomainChangeHistoryView(APIView):
    """List registration change history for a domain.

    GET /api/v1/domains/{id}/history/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, domain_id):
        org_id = request.user.organization_id
        limit = int(request.query_params.get("limit", 50))
        try:
            history = DomainService.get_change_history(domain_id, org_id, limit=limit)
            serializer = DomainChangeHistorySerializer(history, many=True)
            return success_response(serializer.data)
        except ObjectDoesNotExist:
            return error_response("Domain not found.", status_code=status.HTTP_404_NOT_FOUND)


class DomainSuggestionsView(APIView):
    """Discover unwatched root domains used across Uptime, SSL, and DNS.

    GET /api/v1/domains/suggestions/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        suggestions = DomainService.get_unwatched_domains(org_id)
        return success_response(suggestions)
