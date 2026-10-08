"""Bounded configuration previews, separate from persisted monitor cadence."""
import hashlib
import hmac
import json
import math
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.response import Response

from accounts.beta import consume_budget
from common.crypto import decrypt_string, encrypt_string
from common.models import ScanLease
from common.subscriptions import OperationalAPIView

PREFIX = 'configuration-diagnostic:'


class DiagnosticLimited(APIException):
    status_code = 429
    default_code = 'diagnostic_limit'

    def __init__(self, seconds, kind='rate'):
        self.wait = max(1, math.ceil(seconds))
        message = {
            'rate': f'Has realizado varias pruebas seguidas. Puedes guardar el monitor ahora o volver a probar en {self.wait} segundos.',
            'daily': 'Has alcanzado el límite diario de pruebas de configuración. Puedes guardar el monitor; el monitoreo usa la frecuencia de tu plan.',
            'pending': 'Ya hay una prueba de configuración en curso. Espera su resultado; puedes seguir editando o guardar el monitor.',
            'global': 'El servicio de pruebas está ocupado. Puedes guardar el monitor o volver a probar en unos segundos.',
        }[kind]
        super().__init__({'success': False, 'message': message,
                          'errors': {'code': 'DIAGNOSTIC_' + kind.upper(), 'retry_after_seconds': self.wait}})
        self.detail['success'] = False
        self.detail['errors']['retry_after_seconds'] = self.wait


def validate_payload(data):
    if not isinstance(data, dict):
        raise ValidationError('La configuración debe ser un objeto.')
    field = next((key for key in ('endpoint', 'url', 'domain') if key in data), None)
    value = data.get(field) if field else None
    if not isinstance(value, str) or not value.strip() or len(value) > 2048:
        raise ValidationError('Ingresa una dirección válida antes de probar.')
    value = value.strip()
    try:
        parsed = urlsplit(value if '://' in value else '//'+value)
        if not parsed.hostname or any(char.isspace() for char in value) or parsed.username or parsed.password or parsed.port == 0:
            raise ValueError()
        if parsed.scheme and parsed.scheme not in ('http', 'https', 'tcp', 'dns', 'ssl'):
            raise ValueError()
        if 'domain' == field and (parsed.path or parsed.query or parsed.fragment or parsed.scheme):
            raise ValueError()
        if 'port' in data and not 1 <= int(data['port']) <= 65535:
            raise ValueError()
        if 'expected_status' in data and not 100 <= int(data['expected_status']) <= 599:
            raise ValueError()
        if 'max_latency_ms' in data and (not math.isfinite(float(data['max_latency_ms'])) or float(data['max_latency_ms']) <= 0):
            raise ValueError()
        for field in ('headers', 'custom_headers'):
            if field in data and not isinstance(data[field], dict):
                raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError('Revisa la dirección, puerto y campos de configuración.') from None
    serialized = json.dumps(data, sort_keys=True, separators=(',', ':'), cls=DjangoJSONEncoder)
    if len(serialized.encode()) > 65536:
        raise ValidationError('La configuración de prueba es demasiado grande.')
    return serialized


@transaction.atomic
def admit(org):
    now = timezone.now()
    key = PREFIX + str(org.pk)
    ScanLease.objects.get_or_create(resource_key=key, defaults={'organization': org})
    lease = ScanLease.objects.select_for_update().get(resource_key=key)
    if lease.pending_until and lease.pending_until > now:
        raise DiagnosticLimited((lease.pending_until-now).total_seconds(), 'pending')
    # The global budget row also serializes the global concurrency count.
    for kind, identity, limit, window, reason in (
        ('diagnostic-global', 'global', settings.DIAGNOSTIC_GLOBAL_PER_MINUTE, 60, 'global'),
        ('diagnostic-minute', str(org.pk), settings.DIAGNOSTIC_PER_MINUTE, 60, 'rate'),
        ('diagnostic-day', str(org.pk), settings.DIAGNOSTIC_FREE_DAILY if org.plan_tier == 'free' else settings.DIAGNOSTIC_PAID_DAILY, 86400, 'daily'),
    ):
        try:
            consume_budget(kind, identity, limit, window)
        except Throttled as exc:
            raise DiagnosticLimited(exc.wait or window, reason) from None
    if ScanLease.objects.filter(resource_key__startswith=PREFIX, pending_until__gt=now).count() >= settings.DIAGNOSTIC_MAX_CONCURRENT:
        raise DiagnosticLimited(10, 'global')
    lease.token = uuid.uuid4()
    lease.pending_until = now + timedelta(seconds=120)
    lease.next_allowed_at = None
    lease.started = True
    lease.save()
    return lease.pk, lease.token


class ConfigurationDiagnosticAPIView(OperationalAPIView):
    """Subclasses perform a preview only: no checks, tasks, SLA or alerts."""

    def post(self, request):
        serialized = validate_payload(request.data)
        method = str(request.data.get('http_method', request.data.get('method', 'GET'))).upper()
        if method not in ('GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'):
            raise ValidationError('El método HTTP no es válido.')
        http = '/api-checks/' in request.path or request.data.get('target_type', 'http') in ('http', 'https', 'api') and '/monitoring/' in request.path
        reusable = not http or method in ('GET', 'HEAD')
        if http and not reusable and request.data.get('confirm_side_effects') is not True:
            raise ValidationError('Confirma explícitamente esta prueba: el método puede modificar datos en el servicio remoto.')
        identity = f'{request.user.organization_id}:{request.path}:{serialized}'
        digest = hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()
        key = 'diagnostic-result:' + digest
        if reusable:
            try:
                saved = cache.get(key)
                if saved:
                    payload = json.loads(decrypt_string(saved))
                    if timezone.now() < datetime.fromisoformat(payload['diagnostic']['expires_at']):
                        payload['diagnostic']['cached'] = True
                        return Response(payload, headers={'Cache-Control': 'no-store'})
            except Exception:
                pass  # Cache is optional; database admission never fails open.
        lease_id, token = admit(request.user.organization)
        try:
            response = self.perform_diagnostic(request)
            response['Cache-Control'] = 'no-store'
            if response.status_code == 200 and isinstance(response.data, dict):
                checked_at = timezone.now()
                response.data['diagnostic'] = {'cached': False, 'checked_at': checked_at.isoformat(),
                    'expires_at': (checked_at + timedelta(seconds=settings.DIAGNOSTIC_CACHE_SECONDS)).isoformat()}
                if reusable:
                    payload = json.dumps(response.data, cls=DjangoJSONEncoder)
                    if len(payload.encode()) <= 65536:
                        try:
                            cache.set(key, encrypt_string(payload), settings.DIAGNOSTIC_CACHE_SECONDS)
                        except Exception:
                            pass
            return response
        finally:
            ScanLease.objects.filter(pk=lease_id, token=token).update(pending_until=None, token=None, started=False)

    def handle_exception(self, exc):
        if isinstance(exc, DiagnosticLimited):
            return Response(exc.detail, status=429, headers={'Retry-After': str(exc.wait), 'Cache-Control': 'no-store'})
        return super().handle_exception(exc)
