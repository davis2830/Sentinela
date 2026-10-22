"""Durable protocol-v2 execution receipts, scoped to organization and probe."""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from common.scan_limits import finish
from common.subscriptions import require_monitoring
from .agent_payload import AgentResultSerializer
from .models import AgentExecution, MonitoringCheck, MonitoringTarget

logger = logging.getLogger(__name__)


def redeliver(probe, capacity, known):
    # Redeliver a lost heartbeat response only during its original run window.
    executions = AgentExecution.objects.filter(
        organization_id=probe.organization_id, probe=probe, accepted_at__isnull=True,
        created_at__gte=timezone.now()-timedelta(minutes=10),
        target__enabled=True, target__runner_type='agent', target__agent_probe=probe,
    ).exclude(id__in=known).order_by('created_at')[:capacity]
    return [e.payload for e in executions]


def issue(probe, target, token, payload):
    now = timezone.now()
    payload = {**payload, 'execution_id': str(token), 'issued_at': now.isoformat(),
               'run_before': (now+timedelta(minutes=10)).isoformat()}
    AgentExecution.objects.create(id=token, organization_id=probe.organization_id,
        probe=probe, target=target, payload=payload, expires_at=now+timedelta(hours=24))
    return payload


@transaction.atomic
def ingest_one(probe, item):
    execution = AgentExecution.objects.select_for_update().filter(
        id=item['execution_id'], organization_id=probe.organization_id,
        probe=probe, target_id=item['target_id']).first()
    if not execution:
        return 'rejected', 'unknown_execution'
    if execution.accepted_at:
        return 'duplicate', None
    now = timezone.now()
    if execution.expires_at <= now:
        return 'rejected', 'expired_execution'
    target = MonitoringTarget.objects.select_for_update().filter(
        id=item['target_id'], organization_id=probe.organization_id,
        agent_probe=probe, runner_type='agent', enabled=True).first()
    if not target:
        return 'rejected', 'target_unavailable'
    completed = item['completed_at']
    if (completed < execution.created_at-timedelta(minutes=5) or
        completed > min(now+timedelta(minutes=5), execution.created_at+timedelta(minutes=15))):
        return 'rejected', 'invalid_completion_time'
    completed = min(completed, now)
    policy = {key: execution.payload[key] for key in ('max_latency_ms', 'expected_status')}
    status = item['status']
    if status in ('up', 'slow'):
        status = 'slow' if item['response_time_ms'] > policy['max_latency_ms'] else 'up'
    details = {'execution_id': str(execution.id),
               'evaluation_policy': {**policy, 'source': 'server_issued'}}
    if item.get('http_status') is not None:
        details['status_code'] = item['http_status']
    if item.get('error_message'):
        details['error'] = item['error_message']
    check = MonitoringCheck.objects.create(target=target, status=status,
        latency=item['response_time_ms'], checked_at=completed, details=details)
    execution.accepted_at = now
    # Once accepted, keep the receipt but remove the task's credentials/body.
    execution.payload = {}
    execution.save(update_fields=['accepted_at', 'payload', 'updated_at'])
    finish(target, execution.id)  # Token filter never releases a newer execution's lease.
    if not target.last_checked_at or completed >= target.last_checked_at:
        target.last_status = status
        target.last_latency = check.latency
        target.last_checked_at = completed
        target.save(update_fields=['last_status','last_latency','last_checked_at'])
        from alerts.services import AlertEvaluatorService
        from alerts.models import AlertRule
        from django.db.models import Q
        try:
            # Savepoint keeps a failed evaluator from breaking the result receipt.
            with transaction.atomic():
                for rule in AlertRule.objects.filter(organization_id=probe.organization_id,
                    enabled=True, target_type='monitoring').filter(Q(target_id=target.id) | Q(target_id__isnull=True)):
                    AlertEvaluatorService._evaluate_rule(rule)
        except Exception:
            logger.exception('Agent alert evaluation failed for check %s', check.pk)
    return 'accepted', None


def ingest_batch(probe, results):
    require_monitoring(probe.organization)
    acknowledgements = []
    for raw in results:
        serializer = AgentResultSerializer(data=raw)
        if not serializer.is_valid() or 'execution_id' not in serializer.validated_data:
            acknowledgements.append({'execution_id': str(raw.get('execution_id','')) if isinstance(raw,dict) else '',
                                     'status':'rejected','reason':'invalid_result'})
            continue
        item = serializer.validated_data
        status, reason = ingest_one(probe, item)
        acknowledgements.append({'execution_id': str(item['execution_id']), 'status':status,
                                 **({'reason':reason} if reason else {})})
    return acknowledgements
