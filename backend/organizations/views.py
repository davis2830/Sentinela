from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    OrganizationCreateSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
)
from .services import OrganizationService


class OrganizationListView(APIView):
    """Endpoint for listing and creating organizations.

    GET /api/v1/organizations/
    POST /api/v1/organizations/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        organizations = OrganizationService.list_organizations()
        serializer = OrganizationSerializer(organizations, many=True)
        return success_response(serializer.data)

    def post(self, request):
        serializer = OrganizationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            organization = OrganizationService.create_organization(
                name=serializer.validated_data["name"],
                slug=serializer.validated_data["slug"],
                timezone=serializer.validated_data.get("timezone", "UTC"),
                locale=serializer.validated_data.get("locale", "en-US"),
            )
            response_serializer = OrganizationSerializer(organization)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class OrganizationDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an organization.

    GET /api/v1/organizations/{id}/
    PATCH /api/v1/organizations/{id}/
    DELETE /api/v1/organizations/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, organization_id):
        try:
            organization = OrganizationService.get_organization(organization_id)
            serializer = OrganizationSerializer(organization)
            return success_response(serializer.data)
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, organization_id):
        serializer = OrganizationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            organization = OrganizationService.update_organization(
                organization_id, **serializer.validated_data
            )
            response_serializer = OrganizationSerializer(organization)
            return success_response(response_serializer.data)
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def delete(self, request, organization_id):
        try:
            OrganizationService.delete_organization(organization_id)
            return success_response({"detail": "Organization deleted."})
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )