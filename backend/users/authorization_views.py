from rest_framework import serializers
from rest_framework.views import APIView

from accounts.models import User
from common.permissions import IsOrgAdmin
from common.responses import success_response
from common.authorization import catalog, effective_permissions
from users.authorization import configure, snapshot


class AuthorizationInput(serializers.Serializer):
    authorization_mode = serializers.ChoiceField(choices=["legacy", "custom"])
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    role_ids = serializers.ListField(child=serializers.UUIDField(), required=False)


class UserAuthorizationView(APIView):
    permission_classes = (IsOrgAdmin,)

    def get(self, request, user_id):
        user = User.objects.get(pk=user_id, organization_id=request.user.organization_id)
        data = snapshot(user)
        data["custom_permissions"] = effective_permissions(user, mode="custom")
        return success_response(data)

    def put(self, request, user_id):
        serializer = AuthorizationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        return success_response(
            configure(
                actor=request.user,
                user_id=user_id,
                mode=values["authorization_mode"],
                reason=values["reason"],
                role_ids=values.get("role_ids"),
            )
        )


class AuthorizationCatalogView(APIView):
    permission_classes = (IsOrgAdmin,)

    def get(self, request):
        return success_response(catalog())
