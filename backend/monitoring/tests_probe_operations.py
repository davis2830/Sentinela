from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from organizations.models import Organization
from .models import AgentExecution, AgentProbe, MonitoringTarget
from .serializers import AgentProbeSerializer
from .probe_telemetry import ProbeTelemetrySerializer
from rest_framework.test import APIClient


class ProbeOperationsTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Operations', slug='probe-operations')
        self.raw, hashed = AgentProbe.generate_token()
        self.probe = AgentProbe.objects.create(
            organization=self.org, name='LAN', token_hash=hashed,
            last_heartbeat=timezone.now(), version='1.6.0',
        )
        self.target = MonitoringTarget.objects.create(
            organization=self.org, name='LAN API', endpoint='https://service.test',
            runner_type='agent', agent_probe=self.probe,
        )

    def status(self):
        return AgentProbeSerializer(self.probe).data['delivery']

    def execution(self, **kwargs):
        return AgentExecution.objects.create(
            organization=self.org, probe=self.probe, target=self.target,
            expires_at=timezone.now()+timedelta(hours=24), **kwargs,
        )

    def test_connected_without_receipts_is_unknown(self):
        self.assertEqual(self.status()['state'], 'unknown')
        self.assertIsNone(self.status()['last_received_at'])

    def test_pending_delayed_and_received_are_separate(self):
        execution = self.execution()
        self.assertEqual(self.status()['state'], 'pending')
        AgentExecution.objects.filter(pk=execution.pk).update(
            created_at=timezone.now()-timedelta(minutes=11))
        self.assertEqual(self.status()['state'], 'overdue')
        self.assertEqual(self.status()['overdue'], 1)
        execution.accepted_at = timezone.now()
        execution.save(update_fields=['accepted_at'])
        delivery = self.status()
        self.assertEqual(delivery['state'], 'received')
        self.assertEqual(delivery['pending'], 0)
        self.assertIsNotNone(delivery['last_received_at'])
        self.probe.last_heartbeat = timezone.now()-timedelta(seconds=46)
        self.assertEqual(self.status()['state'], 'offline')

    def test_foreign_ledger_and_secrets_do_not_leak(self):
        other = Organization.objects.create(name='Other', slug='probe-operations-other')
        AgentExecution.objects.create(
            organization=other, probe=self.probe, target=self.target,
            expires_at=timezone.now(), payload={'token': 'secret-fixture'},
            accepted_at=timezone.now(),
        )
        data = AgentProbeSerializer(self.probe).data
        self.assertEqual(data['delivery']['state'], 'unknown')
        self.assertNotIn('secret-fixture', str(data))
        self.assertNotIn('token_hash', data)

    def snapshot(self):
        return {'schema_version': 1, 'queue': {'queued': 1, 'running': 2, 'ready': 3},
                'queue_limit': 1000, 'draining': True, 'rejected_retained': 0,
                'last_ack_at': timezone.now().isoformat(), 'last_rejection_at': None,
                'errors': [{'component': 'delivery', 'code': 'delivery_unconfirmed', 'failures': 2}]}

    def test_authenticated_heartbeat_persists_report_and_legacy_clears_it(self):
        client = APIClient()
        url = '/api/v1/agent-probes/heartbeat/'
        payload = {'delivery_protocol': 2, 'capacity': 10, 'telemetry': self.snapshot()}
        self.assertEqual(client.post(url, payload, format='json').status_code, 401)
        self.assertEqual(client.post(url, {**payload, 'delivery_protocol': 1}, format='json',
                                     HTTP_X_PROBE_TOKEN=self.raw).status_code, 400)
        response = client.post(url, payload, format='json', HTTP_X_PROBE_TOKEN=self.raw)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['tasks'], [])  # Drain overrides advertised capacity.
        self.probe.refresh_from_db()
        result = AgentProbeSerializer(self.probe).data['telemetry']
        self.assertEqual(result['state'], 'current')
        self.assertEqual(result['snapshot']['queue']['ready'], 3)
        self.assertTrue(result['snapshot']['draining'])
        self.assertIsNone(self.status()['last_received_at'])  # Agent cannot forge a server receipt.
        self.probe.telemetry_received_at = timezone.now()-timedelta(seconds=46)
        self.assertEqual(AgentProbeSerializer(self.probe).data['telemetry']['state'], 'stale')
        self.assertEqual(client.post(url, {'delivery_protocol': 1}, format='json',
                                     HTTP_X_PROBE_TOKEN=self.raw).status_code, 200)
        self.probe.refresh_from_db()
        self.assertEqual(AgentProbeSerializer(self.probe).data['telemetry']['state'], 'unknown')

    def test_rejects_unbounded_counts_raw_errors_and_inconsistent_unknown_queue(self):
        import copy
        invalid = []
        for key, value in [('queue_limit', 1001), ('draining', 'true'), ('schema_version', True),
                           ('errors', [{'message': 'private secret'}]), ('queue', None),
                           ('queue', {'queued': 1001, 'running': 0, 'ready': 0}),
                           ('last_ack_at', (timezone.now()+timedelta(hours=1)).isoformat())]:
            snapshot = copy.deepcopy(self.snapshot()); snapshot[key] = value; invalid.append(snapshot)
        snapshot = self.snapshot(); snapshot['token'] = 'private secret'; invalid.append(snapshot)
        for snapshot in invalid:
            with self.subTest(snapshot=snapshot):
                serializer = ProbeTelemetrySerializer(data=snapshot)
                self.assertFalse(serializer.is_valid())
        snapshot = self.snapshot(); snapshot['queue'] = None
        snapshot['errors'] = [{'component': 'storage', 'code': 'local_storage', 'failures': 1}]
        self.assertTrue(ProbeTelemetrySerializer(data=snapshot).is_valid())

    def test_bad_telemetry_does_not_update_heartbeat_or_store_secrets(self):
        before = self.probe.last_heartbeat
        payload = {'delivery_protocol': 2, 'telemetry': {'token': 'secret-fixture'}}
        response = APIClient().post('/api/v1/agent-probes/heartbeat/', payload, format='json',
                                    HTTP_X_PROBE_TOKEN=self.raw)
        self.assertEqual(response.status_code, 400)
        self.probe.refresh_from_db()
        self.assertEqual(self.probe.last_heartbeat, before)
        self.assertIsNone(self.probe.operational_snapshot)
