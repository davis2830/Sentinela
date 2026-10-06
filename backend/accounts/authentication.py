"""
Authentication classes for Sentinel.
Supports custom API token authentication for programmatic access.
"""

import hashlib

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import SAFE_METHODS

from .models import APIToken
from .eligibility import require_identity
from rest_framework_simplejwt.authentication import JWTAuthentication


class SentinelJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            require_identity(user)
        except ValueError as exc:
            raise AuthenticationFailed(str(exc)) from None
        if validated_token.get("session_version", 0) != user.session_version:
            raise AuthenticationFailed("La sesión ya no está vigente. Inicia sesión nuevamente.")
        return user


class SentinelAPITokenAuthentication(BaseAuthentication):
    """Custom authentication class for Sentinel API tokens (snt_...).

    Allows external scripts, CI/CD pipelines, and SDKs to authenticate
    against Sentinel REST endpoints using HTTP Authorization headers:
        Authorization: Bearer snt_<token_hex>
        Authorization: Token snt_<token_hex>
    """

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2:
            return None

        prefix, token = parts
        prefix_lower = prefix.lower()

        # If it's not a Bearer or Token header, skip
        if prefix_lower not in ("bearer", "token"):
            return None

        # If it doesn't look like a Sentinel API token (snt_...), let JWTAuthentication handle it
        if not token.startswith("snt_"):
            return None

        try:
            api_token = (
                APIToken.objects.select_related("user", "user__organization")
                .filter(token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest())
                .first()
            )
        except Exception:
            return None

        if not api_token:
            raise AuthenticationFailed("Token de API no válido.")

        if api_token.is_expired:
            raise AuthenticationFailed("El token de API ha expirado.")

        user = api_token.user
        try:
            require_identity(user)
        except ValueError as exc:
            raise AuthenticationFailed(str(exc)) from None
        if not user.is_active:
            raise AuthenticationFailed("La cuenta de usuario asociada a este token está desactivada.")

        # Enforce read-only scope for mutation HTTP methods
        if api_token.scope == "read" and request.method not in SAFE_METHODS:
            raise PermissionDenied("Este token de API tiene permisos de solo lectura (scope: read).")

        # Update last_used_at timestamp without changing updated_at of the user
        APIToken.objects.filter(id=api_token.id).update(last_used_at=timezone.now())

        return (user, api_token)

    def authenticate_header(self, request):
        return 'Bearer realm="Sentinel API Token"'
