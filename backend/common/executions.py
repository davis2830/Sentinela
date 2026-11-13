"""Execution receipts and post-commit admission shared by initial and manual scans."""

import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.http import Http404
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from common.authorization import effective_permissions
from common.models import ScanExecution
from common.responses import success_response


def initial_scan(resource, task):
    def enqueue():
        from .scan_limits import enqueue_scan, ScanLimited

        try:
            enqueue_scan(resource, task)
        except ScanLimited:
            return
        except Exception:
            logging.getLogger(__name__).exception("Initial scan admission failed resource=%s", resource.pk)

    transaction.on_commit(enqueue)


def agent_receipt(receipt):
    return {
        "id": str(receipt.pk),
        "state": "completed"
        if receipt.accepted_at
        else "expired"
        if min(receipt.expires_at, receipt.created_at + timedelta(minutes=10)) <= timezone.now()
        else "queued",
        "error_code": "",
        "origin": "agent",
    }


class ScanExecutionView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, execution_id):
        result = ScanExecution.objects.filter(pk=execution_id, organization_id=request.user.organization_id).first()
        if result is None:
            from monitoring.models import AgentExecution

            agent = AgentExecution.objects.filter(pk=execution_id, organization_id=request.user.organization_id).first()
            if agent is None:
                raise Http404()
            if "monitoring.read" not in effective_permissions(request.user):
                raise PermissionDenied()
            response = success_response(
                {
                    **agent_receipt(agent),
                    "submitted_at": agent.created_at,
                    "started_at": None,
                    "finished_at": agent.accepted_at,
                    "error_code": "",
                }
            )
            response["Cache-Control"] = "no-store"
            return response
        if f"{result.module}.read" not in effective_permissions(request.user):
            raise PermissionDenied()
        state = (
            "expired" if result.state in ("queued", "running") and result.expires_at <= timezone.now() else result.state
        )
        response = success_response(
            {
                "id": str(result.pk),
                "state": state,
                "submitted_at": result.created_at,
                "started_at": result.started_at,
                "finished_at": result.finished_at,
                "error_code": result.error_code,
                "origin": "cloud",
            }
        )
        response["Cache-Control"] = "no-store"
        return response


def record(resource, token, **fields):
    from .execution_context import fingerprint

    key = f"{resource.organization_id}:{resource._meta.label_lower}:{resource.pk}"
    obj, _ = ScanExecution.objects.get_or_create(
        pk=token,
        defaults={
            "organization_id": resource.organization_id,
            "resource_key": key,
            "module": resource._meta.app_label,
            "expires_at": timezone.now() + timedelta(minutes=10),
            "configuration_hash": fingerprint(resource),
        },
    )
    ScanExecution.objects.filter(pk=obj.pk, organization_id=resource.organization_id).update(**fields)
