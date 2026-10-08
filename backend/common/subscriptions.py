"""Single operational entitlement policy, independent of the daily billing job."""
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView


MESSAGE = (
    "Tu prueba o suscripción no está vigente. No puedes agregar recursos, "
    "modificarlos ni ejecutar escaneos hasta adquirir un plan y confirmar el pago. "
    "La integración de pagos está pendiente; contacta al administrador para contratar."
)


def monitoring_allowed(organization):
    if not organization or organization.status != "active":
        return False
    if organization.beta_managed and organization.beta_status != "active":
        return False
    if organization.subscription_status == "active":
        return True
    return bool(
        organization.subscription_status == "trialing"
        and organization.trial_ends_at
        and organization.trial_ends_at > timezone.now()
    )


class SubscriptionRequired(APIException):
    status_code = 403
    default_code = "subscription_required"

    def __init__(self):
        super().__init__({"success": False, "message": MESSAGE,
                          "errors": {"code": "SUBSCRIPTION_REQUIRED"}})
        self.detail["success"] = False


def require_monitoring(organization):
    if not monitoring_allowed(organization):
        raise SubscriptionRequired()


def eligible_organization_ids():
    from django.db.models import Q
    from organizations.models import Organization
    return Organization.objects.filter(status="active").filter(
        Q(beta_managed=False) | Q(beta_status="active")
    ).filter(
        Q(subscription_status="active")
        | Q(subscription_status="trialing", trial_ends_at__gt=timezone.now())
    ).values("id")


class OperationalAPIView(APIView):
    """Read history and delete resources freely; paid operations require entitlement."""

    def check_permissions(self, request):
        super().check_permissions(request)
        # Probe endpoints authenticate their own tokens and apply the policy in services.
        if request.user.is_authenticated and request.method not in SAFE_METHODS:
            if not (request.user.is_staff or request.user.is_superuser):
                raise PermissionDenied("Solo un administrador puede modificar recursos o ejecutar escaneos.")
            if request.method != "DELETE":
                require_monitoring(getattr(request.user, "organization", None))
            org = request.user.organization
            if org.beta_managed and org.plan_tier == "free" and request.method == "POST":
                from accounts.beta import consume_budget
                if request.path.rstrip('/').rsplit('/', 1)[-1] in (
                    "monitoring", "api-checks", "ssl-certificates", "dns-records", "domains", "security-headers"
                ):
                    consume_budget("beta-resource-creation", str(org.pk), 10, 86400)

    def handle_exception(self, exc):
        from common.scan_limits import ScanLimited, limited_response
        if isinstance(exc, ScanLimited):
            return limited_response(exc)
        return super().handle_exception(exc)
