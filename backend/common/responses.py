from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone


def success_response(data=None, status_code=status.HTTP_200_OK, message=None):
    """Standard success response format.

    {
        "success": true,
        "data": {},
        "message": "..." (optional)
    }
    """
    payload = {"success": True, "data": data if data is not None else {}}
    if message is not None:
        payload["message"] = message
    return Response(payload, status=status_code)


def error_response(message, errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    """Standard error response format.

    {
        "success": false,
        "message": "...",
        "errors": []
    }
    """
    payload = {"success": False, "message": message}
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def queued_scan_response(task, resource_id):
    """Canonical response for asynchronous individual scan endpoints."""
    submitted_at = timezone.now()
    return success_response(
        {
            "task_id": task.id,
            "resource_id": str(resource_id),
            "status": "queued",
            "submitted_at": submitted_at.isoformat(),
        },
        status_code=status.HTTP_202_ACCEPTED,
    )
