"""Post-commit coverage admission with an observable, safe failure state."""

import logging
from django.db import transaction
from .models import MonitoringTarget


def schedule(target, modules, actor=None):
    if modules == []:
        target.coverage_status = {"state": "completed", "created": [], "existing": [], "failed": {}}
        target.save(update_fields=["coverage_status"])
        return
    from .tasks import register_target_in_submonitors
    from common.authorization import uses_custom_permissions

    target.coverage_status = {"state": "queued", "requested": modules}
    target.save(update_fields=["coverage_status"])

    def send():
        try:
            args = [str(target.pk), modules]
            if actor is not None and uses_custom_permissions(actor):
                args.append(str(actor.pk))
            register_target_in_submonitors.delay(*args)
        except Exception:
            MonitoringTarget.objects.filter(pk=target.pk, organization_id=target.organization_id).update(
                coverage_status={"state": "failed", "code": "BROKER_UNAVAILABLE"}
            )
            logging.getLogger(__name__).exception("Coverage admission failed target=%s", target.pk)

    transaction.on_commit(send)
