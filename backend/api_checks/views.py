from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    APICheckResultSerializer,
    APICheckTargetCreateSerializer,
    APICheckTargetSerializer,
    APICheckTargetUpdateSerializer,
)
from .services import APICheckService


class APICheckTargetListView(APIView):
    """Endpoint for listing and creating API check targets.

    GET /api/v1/api-checks/
    POST /api/v1/api-checks/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        targets = APICheckService.list_targets(org_id)
        serializer = APICheckTargetSerializer(targets, many=True)
        return success_response(serializer.data)

    def post(self, request):
        org_id = request.user.organization_id
        serializer = APICheckTargetCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = APICheckService.create_target(
                organization_id=org_id,
                **serializer.validated_data,
            )
            from .tasks import run_api_check
            run_api_check(str(target.id))
            updated_target = APICheckService.get_target(target.id, org_id)
            response_serializer = APICheckTargetSerializer(updated_target)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class APICheckTargetDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an API check target.

    GET /api/v1/api-checks/{id}/
    PATCH /api/v1/api-checks/{id}/
    DELETE /api/v1/api-checks/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = APICheckService.get_target(target_id, org_id)
            serializer = APICheckTargetSerializer(target)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "API check target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, target_id):
        org_id = request.user.organization_id
        serializer = APICheckTargetUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = APICheckService.update_target(
                target_id, org_id, **serializer.validated_data
            )
            response_serializer = APICheckTargetSerializer(target)
            return success_response(response_serializer.data)
        except Exception:
            return error_response(
                "API check target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def delete(self, request, target_id):
        org_id = request.user.organization_id
        try:
            APICheckService.delete_target(target_id, org_id)
            return success_response({"detail": "API check target deleted."})
        except Exception:
            return error_response(
                "API check target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )


class APICheckTargetScanView(APIView):
    """Endpoint to trigger manual API check.

    POST /api/v1/api-checks/{id}/scan/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, target_id):
        org_id = request.user.organization_id
        try:
            target = APICheckService.get_target(target_id, org_id)
            from .tasks import run_api_check
            run_api_check(str(target.id))
            updated_target = APICheckService.get_target(target_id, org_id)
            serializer = APICheckTargetSerializer(updated_target)
            return success_response(serializer.data)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class APICheckResultListView(APIView):
    """Endpoint for listing check results for a target.

    GET /api/v1/api-checks/{id}/results/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, target_id):
        org_id = request.user.organization_id
        limit = int(request.query_params.get("limit", 50))
        try:
            results = APICheckService.list_results(target_id, org_id, limit=limit)
            serializer = APICheckResultSerializer(results, many=True)
            return success_response(serializer.data)
        except Exception:
            return error_response(
                "API check target not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )


class APICheckStatsView(APIView):
    """Endpoint for API check KPI summary statistics.

    GET /api/v1/api-checks/stats/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        stats_data = APICheckService.get_api_check_stats(org_id)
        return success_response(stats_data)


class APICheckBulkScanView(APIView):
    """Endpoint to trigger bulk execution for all API checks.

    POST /api/v1/api-checks/scan-all/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            from .tasks import run_all_api_checks
            run_all_api_checks.delay()
            return success_response({"message": "Validación masiva de API Endpoints iniciada."})
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)


class APICheckTestRequestView(APIView):
    """Endpoint to test an API endpoint in real time before creating or updating.

    POST /api/v1/api-checks/test-request/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        url = request.data.get("url", "").strip()
        if not url:
            return error_response(
                "La URL del endpoint es obligatoria.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        method = request.data.get("method", "GET").strip().upper()
        headers = request.data.get("headers", {})
        body = request.data.get("body", {})

        result = APICheckService.test_request(
            url=url,
            method=method,
            headers=headers,
            body=body,
        )
        return success_response(result)


class APICheckBulkActionView(APIView):
    """Endpoint to perform bulk operations (scan, pause, resume, delete) on targets.

    POST /api/v1/api-checks/bulk-action/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        org_id = request.user.organization_id
        action = request.data.get("action")
        target_ids = request.data.get("target_ids", [])

        if not action or not target_ids:
            return error_response(
                "Parámetros 'action' y 'target_ids' son obligatorios.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            res = APICheckService.bulk_action(org_id, action, target_ids)
            return success_response(res)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)