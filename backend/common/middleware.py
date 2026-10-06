import hashlib
import ipaddress
from django.conf import settings
from django.http import JsonResponse
from common.client_ip import get_client_ip


class IPAllowlistMiddleware:
    """Middleware that restricts access to the organization's NOC console

    based on the configured `allowed_ip_ranges` CIDR/IP list.
    If the list is empty, access is unrestricted.
    """

    EXEMPT_PATHS = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/status-page/public",
        "/api/v1/monitoring/probe",
        "/health",
        "/api/v1/health",
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Allow unrestricted access to exempt public paths
        path = request.path_info
        for exempt in self.EXEMPT_PATHS:
            if path.startswith(exempt):
                return self.get_response(request)

        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            auth_header = request.META.get("HTTP_AUTHORIZATION", "")
            if auth_header.startswith("Bearer snt_") or auth_header.startswith("Token snt_"):
                token_str = auth_header.split(" ", 1)[1].strip()
                try:
                    from accounts.models import APIToken
                    token_hash = hashlib.sha256(token_str.encode("utf-8")).hexdigest()
                    api_tok = APIToken.objects.select_related("user", "user__organization").filter(token_hash=token_hash).first()
                    if api_tok and not api_tok.is_expired and api_tok.user.is_active:
                        user = api_tok.user
                        request.user = user
                except Exception:
                    pass
            elif auth_header.startswith("Bearer "):
                token_str = auth_header.split(" ", 1)[1].strip()
                try:
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    jwt_auth = JWTAuthentication()
                    validated_token = jwt_auth.get_validated_token(token_str)
                    user = jwt_auth.get_user(validated_token)
                    request.user = user
                except Exception:
                    pass

        if user and user.is_authenticated and not user.is_superuser:
            org = getattr(user, "organization", None)
            if org and org.allowed_ip_ranges:
                raw_ranges = org.allowed_ip_ranges.strip()
                if raw_ranges:
                    client_ip = self._get_client_ip(request)
                    if not self._is_ip_allowed(client_ip, raw_ranges, request=request):
                        return JsonResponse(
                            {
                                "success": False,
                                "message": (
                                    f"Acceso denegado por política de seguridad corporativa. "
                                    f"Tu dirección IP ({client_ip}) no está en la lista blanca autorizada para {org.name}."
                                ),
                                "errors": {
                                    "code": "IP_NOT_ALLOWED",
                                    "client_ip": client_ip,
                                },
                            },
                            status=403,
                        )

        return self.get_response(request)

    def _get_client_ip(self, request):
        return get_client_ip(request)

    @staticmethod
    def _is_trusted_proxy(remote_addr):
        try:
            peer = ipaddress.ip_address(remote_addr)
        except ValueError:
            return False
        for raw_cidr in getattr(settings, "TRUSTED_PROXY_CIDRS", []):
            try:
                if peer in ipaddress.ip_network(raw_cidr, strict=False):
                    return True
            except ValueError:
                continue
        return False


    def _is_ip_allowed(self, client_ip_str, raw_ranges_str, request=None):
        try:
            client_obj = ipaddress.ip_address(client_ip_str)
        except ValueError:
            return False

        # Allow localhost / internal loopback during local development only if REMOTE_ADDR is also loopback
        real_remote = request.META.get("REMOTE_ADDR", "") if request else client_ip_str
        if (client_obj.is_loopback or client_ip_str in ("127.0.0.1", "::1")) and settings.DEBUG:
            if real_remote in ("127.0.0.1", "::1", "localhost"):
                return True

        ranges = [r.strip() for r in raw_ranges_str.replace("\n", ",").split(",") if r.strip()]
        for r in ranges:
            try:
                # Can be a CIDR (e.g. 192.168.1.0/24) or single IP (10.0.0.5)
                net = ipaddress.ip_network(r, strict=False)
                if client_obj in net:
                    return True
            except ValueError:
                continue

        return False
