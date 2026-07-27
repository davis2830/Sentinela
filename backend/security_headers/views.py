from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

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
        serializer = SecurityHeaderTargetSerializer(targets, many=True)
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

        try:
            target = SecurityHeadersService.create_target(
                organization_id=org_id,
                name=serializer.validated_data["name"],
                url=serializer.validated_data["url"],
                enabled=serializer.validated_data.get("enabled", True),
            )
            from .tasks import scan_security_headers
            scan_security_headers.delay(str(target.id))

            response_serializer = SecurityHeaderTargetSerializer(target)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class SecurityHeaderTargetDetailView(APIView):
    """Endpoint for retrieving and deleting a security header target.

    GET /api/v1/security-headers/{id}/
    DELETE /api/v1/security-headers/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = SecurityHeadersService.get_target(target_id, org_id)
            serializer = SecurityHeaderTargetSerializer(target)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "Security header target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
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