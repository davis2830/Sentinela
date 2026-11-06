"""Short, revocable platform sessions backed by Django's session table."""
import re
from datetime import timedelta
from secrets import token_urlsafe
from uuid import uuid4

import pyotp
from django.contrib.auth import authenticate
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework import serializers
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from audit.services import AuditService
from common.client_ip import get_client_ip
from common.crypto import decrypt_string
from common.permissions import IsSuperUser
from common.responses import error_response, success_response
from .beta import consume_budget
from .eligibility import require_identity
from .models import User

SESSION_SECONDS = 600
CHALLENGE_SALT = "sentinel.platform.login"


def session_key(token):
    return salted_hmac("sentinel.platform.session", token, algorithm="sha256").hexdigest()[:40]


def credential_stamp(user):
    return salted_hmac(
        "sentinel.platform.credentials",
        f"{user.password}:{user.totp_secret}:{user.session_version}",
        algorithm="sha256",
    ).hexdigest()


def platform_identity(user):
    require_identity(user)
    if not user.is_superuser or not user.is_2fa_enabled or not user.totp_secret:
        raise ValueError("Se requiere una cuenta de superadmin con 2FA activo.")


class PlatformAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Bearer realm="Sentinel Platform"'

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None
        if len(header) != 2 or header[0].lower() != b"bearer" or not header[1].startswith(b"sap_"):
            raise AuthenticationFailed("Inicia sesión en Administración SaaS.")
        token = header[1][4:]
        if not re.fullmatch(rb"[A-Za-z0-9_-]{43}", token):
            raise AuthenticationFailed("La sesión administrativa venció.")
        session = SessionStore(session_key=session_key(token.decode("ascii")))
        user_id = session.get("platform_user")
        if not user_id:
            raise AuthenticationFailed("La sesión administrativa venció.")
        user = User.objects.select_related("organization").filter(pk=user_id).first()
        try:
            platform_identity(user)
        except ValueError as exc:
            raise AuthenticationFailed(str(exc)) from None
        if not constant_time_compare(session.get("platform_stamp", ""), credential_stamp(user)):
            raise AuthenticationFailed("La sesión administrativa venció.")
        return user, session


class PlatformAPIView(APIView):
    authentication_classes = (PlatformAuthentication,)
    permission_classes = (IsSuperUser,)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class PlatformLoginView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        class Credentials(serializers.Serializer):
            email = serializers.EmailField(max_length=254)
            password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)

        payload = Credentials(data=request.data)
        payload.is_valid(raise_exception=True)
        email = payload.validated_data["email"].lower()
        consume_budget("platform-login-ip", get_client_ip(request), 30, 900)
        consume_budget("platform-login-email", email, 8, 900)
        user = authenticate(request, email=email, password=payload.validated_data["password"])
        if not user or not user.is_superuser:
            return error_response("Credenciales administrativas incorrectas.", status_code=401)
        try:
            platform_identity(user)
        except ValueError as exc:
            return error_response(str(exc), status_code=403)
        challenge = signing.dumps({
            "user": str(user.pk), "stamp": credential_stamp(user), "nonce": uuid4().hex,
        }, salt=CHALLENGE_SALT)
        response = success_response({"challenge": challenge})
        response["Cache-Control"] = "no-store"
        return response


class PlatformVerifyView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        class Verification(serializers.Serializer):
            challenge = serializers.CharField(max_length=1024)
            code = serializers.RegexField(r"^[0-9]{6}$", max_length=6)

        payload = Verification(data=request.data)
        payload.is_valid(raise_exception=True)
        consume_budget("platform-verify-ip", get_client_ip(request), 30, 300)
        try:
            challenge = signing.loads(payload.validated_data["challenge"], salt=CHALLENGE_SALT, max_age=300)
        except signing.BadSignature:
            return error_response("El paso de verificación venció. Inicia sesión de nuevo.", status_code=401)
        user = User.objects.select_related("organization").filter(pk=challenge["user"]).first()
        try:
            platform_identity(user)
        except ValueError as exc:
            return error_response(str(exc), status_code=403)
        if not constant_time_compare(challenge["stamp"], credential_stamp(user)):
            return error_response("Las credenciales cambiaron. Inicia sesión de nuevo.", status_code=401)
        consume_budget("platform-verify-user", str(user.pk), 8, 300)
        code = payload.validated_data["code"]
        try:
            valid_code = pyotp.TOTP(decrypt_string(user.totp_secret)).verify(code, valid_window=1)
        except (TypeError, ValueError):
            return error_response("El autenticador requiere recuperación de plataforma.", status_code=403)
        if not valid_code:
            return error_response("Código incorrecto. Revisa tu autenticador.", status_code=401)
        token = token_urlsafe(32)
        with transaction.atomic():
            consume_budget("platform-challenge-used", challenge["nonce"], 1, 300)
            consume_budget("platform-code-used", f"{user.pk}:{code}", 1, 90)
            Session.objects.create(
                session_key=session_key(token),
                session_data=SessionStore().encode({
                    "platform_user": str(user.pk), "platform_stamp": challenge["stamp"],
                }),
                expire_date=timezone.now() + timedelta(seconds=SESSION_SECONDS),
            )
            AuditService.log(
                action="login", module="platform_session", user_id=user.pk, user_email=user.email,
                organization_id=user.organization_id, ip_address=get_client_ip(request),
                description="Inicio de sesión administrativo con 2FA.",
            )
        response = success_response({
            "token": "sap_" + token, "expires_in": SESSION_SECONDS,
            "user": {"id": str(user.pk), "email": user.email},
        })
        response["Cache-Control"] = "no-store"
        return response


class PlatformLogoutView(PlatformAPIView):
    def post(self, request):
        request.auth.delete()
        return success_response()
