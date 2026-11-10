from rest_framework.views import APIView
from common.permissions import IsOrganizationMember
from common.responses import success_response
from .plans import plan_catalog


class PlanCatalogView(APIView):
    permission_classes = (IsOrganizationMember,)

    def get(self, request):
        return success_response(plan_catalog(beta=request.user.organization.beta_managed))
