"""HTTP translation for expected domain failures and safe unexpected errors."""

import logging
import uuid

from django.db import IntegrityError
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

from common.exceptions import NotFoundError, OrganizationNotFoundError, PermissionDeniedError, SentinelError

logger = logging.getLogger(__name__)


def exception_handler(exc, context):
    from organizations.services import QuotaExceededException

    if isinstance(exc, QuotaExceededException):
        from common.responses import error_response

        return error_response(exc)
    if isinstance(exc, (ObjectDoesNotExist, NotFoundError, OrganizationNotFoundError)):
        exc = NotFound("Recurso no encontrado.")
    elif isinstance(exc, PermissionDeniedError):
        exc = PermissionDenied(str(exc))
    elif isinstance(exc, (DjangoValidationError, SentinelError)):
        exc = ValidationError(getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc))
    if isinstance(exc, IntegrityError) and getattr(exc.__cause__, "sqlstate", None) in ("23505", "23503"):
        from rest_framework.response import Response

        return Response(
            {
                "success": False,
                "message": "El recurso entra en conflicto con datos existentes.",
                "errors": {"code": "CONFLICT"},
            },
            status=409,
        )
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response
    from rest_framework.response import Response

    correlation_id = uuid.uuid4().hex
    logger.error(
        "Unhandled API failure correlation_id=%s", correlation_id, exc_info=(type(exc), exc, exc.__traceback__)
    )
    return Response(
        {
            "success": False,
            "message": "No se pudo completar la operación.",
            "errors": {"code": "INTERNAL_ERROR", "correlation_id": correlation_id},
        },
        status=500,
        headers={"X-Correlation-ID": correlation_id},
    )
