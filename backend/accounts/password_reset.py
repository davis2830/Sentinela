"""Explicit password recovery; never activates accounts or bypasses MFA."""
from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from common.client_ip import get_client_ip
from common.responses import error_response, success_response
from . import beta
from .models import User


class RecoveryTokens(PasswordResetTokenGenerator):
    key_salt = 'sentinel.password.recovery'

    def check_token(self, user, token):
        # A short fixed lifetime independent of the JWT/refresh lifetime.
        if not super().check_token(user, token):
            return False
        try:
            issued = int(token.split('-')[0], 36)
            return 0 <= self._num_seconds(self._now()) - issued <= 3600
        except (ValueError, TypeError):
            return False


tokens = RecoveryTokens()


def eligible(user):
    return bool(user and user.is_active and user.has_usable_password()
                and (not user.verification_required or user.email_verified_at))


class PasswordRecoveryView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        class Input(serializers.Serializer):
            email = serializers.EmailField(max_length=254)
            turnstile_token = serializers.CharField(max_length=2048, required=False, default='', allow_blank=True)
        data = Input(data=request.data)
        data.is_valid(raise_exception=True)
        email = data.validated_data['email'].strip().lower()
        ip = get_client_ip(request)
        beta.consume_budget('recovery-ip', ip, 10, 3600)
        beta.consume_budget('recovery-email', email, 3, 3600)
        try:
            beta.validate_captcha(data.validated_data['turnstile_token'], 'password_reset', ip)
            # Validate deployment configuration even for an unknown address.
            beta.public_link('reset-password', 'configuration-check')
            with transaction.atomic():
                user = User.objects.filter(email__iexact=email).first()
                if eligible(user):
                    secret = f'{urlsafe_base64_encode(force_bytes(user.pk))}.{tokens.make_token(user)}'
                    link = beta.public_link('reset-password', secret)
                    beta.queue_mail(user.email, 'Recupera tu acceso a Sentinel',
                        'Solicitaste cambiar tu contraseña de Sentinel. El enlace vence en una hora '
                        'y solo funciona una vez. Si no lo solicitaste, ignora este correo.\n\n'
                        + link + '\n\nTu autenticación de dos pasos se conserva.',
                        timezone.now() + timedelta(hours=1))
            return success_response(message='Si hay una cuenta habilitada con ese correo, '
                'procesaremos un enlace de recuperación. Revisa también spam. No confirma la entrega del correo.', status_code=202)
        except ValueError as exc:
            return error_response(str(exc))


class PasswordResetView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        class Input(serializers.Serializer):
            token = serializers.CharField(max_length=512, write_only=True)
            password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)
        data = Input(data=request.data)
        data.is_valid(raise_exception=True)
        beta.consume_budget('recovery-confirm-ip', get_client_ip(request), 20, 3600)
        try:
            uid, secret = data.validated_data['token'].split('.', 1)
            user_id = urlsafe_base64_decode(uid).decode()
        except (ValueError, TypeError, UnicodeDecodeError, OverflowError):
            return error_response('El enlace no es válido o venció. Solicita uno nuevo.')
        with transaction.atomic():
            try:
                user = User.objects.select_for_update().filter(pk=user_id).first()
            except (ValueError, ValidationError):
                user = None
            if not eligible(user) or not tokens.check_token(user, secret):
                return error_response('El enlace no es válido o venció. Solicita uno nuevo.')
            try:
                validate_password(data.validated_data['password'], user)
            except ValidationError as exc:
                return error_response('Elige una contraseña más segura.', errors={'password': exc.messages})
            # Failure rolls back both password and revocation; never claims partial success.
            user.set_password(data.validated_data['password'])
            user.save(update_fields=['password'])
            for outstanding in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=outstanding)
            from audit.services import AuditService
            AuditService.log(action='config_change', module='accounts', user_id=user.id,
                organization_id=user.organization_id, user_email=user.email,
                description='Contraseña restablecida mediante enlace de recuperación.')
        return success_response(message='Contraseña actualizada. Inicia sesión nuevamente. '
            'Los accesos anteriores pueden durar hasta 15 minutos; los refresh tokens quedaron revocados.')
