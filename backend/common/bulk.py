"""Explicit per-resource outcomes. An ambiguous failure never triggers another mutation."""

import logging
from uuid import UUID
from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from .scan_limits import enqueue_scan, ScanLimited


def operate(model, organization_id, action, ids, task):
    allowed = {"scan", "delete"} | (
        {"pause", "resume"} if any(f.name == "enabled" for f in model._meta.fields) else set()
    )
    if action not in allowed or not isinstance(ids, list) or not 1 <= len(ids) <= 1000:
        raise ValidationError("Acción o selección no válida (máximo 1000).")
    try:
        ids = list(dict.fromkeys(str(UUID(str(x))) for x in ids))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError("Identificadores no válidos.") from None
    results = []
    for identifier in ids:
        item = model.objects.filter(pk=identifier, organization_id=organization_id).first()
        if item is None:
            results.append({"id": identifier, "state": "skipped", "code": "NOT_AVAILABLE"})
            continue
        if (
            action == "resume"
            and getattr(item, "runner_type", None) == "agent"
            and getattr(getattr(item, "agent_probe", None), "revoked_at", None)
        ):
            results.append({"id": identifier, "state": "failed", "code": "PROBE_REVOKED"})
            continue
        try:
            tracking = {}
            if action == "scan":
                admitted = enqueue_scan(item, task)
                tracking = {"execution_id": str(admitted.execution_id)}
            else:
                with transaction.atomic():
                    if action == "resume" and getattr(item, "runner_type", None) == "agent":
                        from monitoring.probe_management import active_binding

                        active_binding(item.agent_probe_id, organization_id)
                    if action == "delete":
                        item.delete()
                    else:
                        model.objects.filter(pk=item.pk, organization_id=organization_id).update(
                            enabled=action == "resume"
                        )
            results.append({"id": identifier, "state": "applied", "code": "", **tracking})
        except ScanLimited:
            results.append({"id": identifier, "state": "skipped", "code": "SCAN_UNAVAILABLE"})
        except (ValidationError, ProtectedError):
            results.append({"id": identifier, "state": "failed", "code": "ACTION_REJECTED"})
        except Exception:
            logging.getLogger(__name__).exception(
                "Bulk action outcome unknown action=%s resource=%s", action, identifier
            )
            results.append({"id": identifier, "state": "unknown", "code": "RECONCILE_REQUIRED"})
    counts = {key: sum(r["state"] == key for r in results) for key in ("applied", "skipped", "failed", "unknown")}
    return {
        "action": action,
        "processed": counts["applied"],
        "affected_count": counts["applied"],
        "queued_count": counts["applied"] if action == "scan" else 0,
        "skipped_count": counts["skipped"],
        "results": results,
        "counts": counts,
        "message": f"{counts['applied']} aplicados; {counts['skipped']} omitidos; {counts['failed']} fallidos; {counts['unknown']} sin confirmar. No se reintentaron operaciones.",
    }
