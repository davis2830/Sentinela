from rest_framework import status
from common.scan_limits import enqueue_scan, enqueue_many, ScanLimited, limited_response
from rest_framework.permissions import IsAuthenticated
from common.subscriptions import OperationalAPIView as APIView

from common.responses import error_response, queued_scan_response, success_response

from .serializers import (
    SecurityHeaderResultSerializer,
    SecurityHeaderTargetCreateSerializer,
    SecurityHeaderTargetSerializer,
)
from .services import SecurityHeadersService


class SecurityHeaderTargetListView(APIView):
    """Endpoint for listing and creating security header targets.

    GET /api/v1/security-headers/
    POST /api/v1/security-headers/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        targets = SecurityHeadersService.list_targets(org_id)
        serializer = SecurityHeaderTargetSerializer(targets, many=True, context={"request": request})
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = SecurityHeaderTargetCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from common.security import validate_safe_public_url, SSRFSecurityException
        try:
            validate_safe_public_url(serializer.validated_data["url"])
        except SSRFSecurityException as s_exc:
            return error_response(str(s_exc), status_code=status.HTTP_400_BAD_REQUEST)

        # Enforce quota limits
        if getattr(request.user, "organization", None):
            try:
                from organizations.services import QuotaService, QuotaExceededException
                QuotaService.check_quota(request.user.organization, "security_headers")
            except QuotaExceededException as qe:
                return error_response(
                    str(qe),
                    errors={"code": "QUOTA_EXCEEDED", "resource": qe.resource_type, "limit": qe.limit, "plan": qe.plan_tier},
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        try:
            target = SecurityHeadersService.create_target(
                organization_id=org_id,
                name=serializer.validated_data["name"],
                url=serializer.validated_data["url"],
                enabled=serializer.validated_data.get("enabled", True),
            )
            from .tasks import scan_security_headers
            scan_security_headers.delay(str(target.id))

            response_serializer = SecurityHeaderTargetSerializer(target, context={"request": request})
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class SecurityHeaderTargetDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting a security header target.

    GET /api/v1/security-headers/{id}/
    PATCH /api/v1/security-headers/{id}/
    DELETE /api/v1/security-headers/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = SecurityHeadersService.get_target(target_id, org_id)
            serializer = SecurityHeaderTargetSerializer(target, context={"request": request})
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Security header target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = SecurityHeadersService.update_target(
                target_id,
                org_id,
                name=request.data.get("name"),
                url=request.data.get("url"),
                enabled=request.data.get("enabled"),
            )
            serializer = SecurityHeaderTargetSerializer(target, context={"request": request})
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(
                str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    def delete(self, request, target_id):
        org_id = request.user.organization_id
        try:
            SecurityHeadersService.delete_target(target_id, org_id)
            return success_response({"detail": "Target deleted."})
        except Exception:
            return error_response(
                "Security header target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )


class SecurityHeaderTargetScanView(APIView):
    """Endpoint to trigger manual Security Headers scan.

    POST /api/v1/security-headers/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = SecurityHeadersService.get_target(target_id, org_id)
            from .tasks import scan_security_headers
            task = enqueue_scan(target, scan_security_headers)
            return queued_scan_response(task, target.id)
        except ScanLimited as exc:
            return limited_response(exc)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SecurityHeaderResultListView(APIView):
    """Endpoint for listing scan results for a target.

    GET /api/v1/security-headers/{id}/results/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        limit = int(request.query_params.get("limit", 50))
        try:
            results = SecurityHeadersService.list_results(
                target_id, org_id, limit=limit
            )
            serializer = SecurityHeaderResultSerializer(results, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Security header target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )


class SecurityHeaderStatsView(APIView):
    """Endpoint for Security Headers KPI summary statistics.

    GET /api/v1/security-headers/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = SecurityHeadersService.get_security_header_stats(org_id)
        return success_response(stats_data)


class SecurityHeaderBulkScanView(APIView):
    """Endpoint to trigger bulk scan for all security header targets.

    POST /api/v1/security-headers/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import scan_security_headers
            from .models import SecurityHeaderTarget
            return success_response(enqueue_many(SecurityHeaderTarget.objects.filter(organization_id=request.user.organization_id), scan_security_headers))
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class SecurityHeaderTestView(APIView):
    """Endpoint to test security headers in real time before saving.

    POST /api/v1/security-headers/test-headers/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        url = request.data.get("url", "").strip()
        if not url:
            return error_response(
                "La URL es requerida para auditar las cabeceras.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from common.security import validate_safe_public_url, SSRFSecurityException
        try:
            validate_safe_public_url(url)
        except SSRFSecurityException as s_exc:
            return error_response(str(s_exc), status_code=status.HTTP_400_BAD_REQUEST)

        result = SecurityHeadersService.test_headers(url)
        return success_response(result)


class SecurityHeaderBulkActionView(APIView):
    """Endpoint to execute bulk actions on security header targets.

    POST /api/v1/security-headers/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        action = request.data.get("action")
        target_ids = request.data.get("target_ids", [])
        if not action or not target_ids:
            return error_response(
                "Parámetros 'action' y 'target_ids' son requeridos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            res = SecurityHeadersService.bulk_action(org_id, action, target_ids)
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
