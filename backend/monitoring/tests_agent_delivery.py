from datetime import timedelta
from io import StringIO
from uuid import uuid4
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from common.models import ScanLease
from organizations.models import Organization
from .models import AgentProbe, AgentExecution, MonitoringTarget
from .services import AgentProbeService
from .agent_delivery import ingest_batch


class AgentDeliveryTests(TestCase):
    def setUp(self):
        self.org=Organization.objects.create(name='Delivery',slug='delivery',beta_managed=False)
        self.token,token_hash=AgentProbe.generate_token()
        self.probe=AgentProbe.objects.create(organization=self.org,name='LAN',token_hash=token_hash)
        self.target=MonitoringTarget.objects.create(organization=self.org,name='API',endpoint='https://example.test',
            runner_type='agent',agent_probe=self.probe,max_latency_ms=500)
        self.client=APIClient()

    def issue(self):
        return AgentProbeService.process_heartbeat(self.probe,delivery_protocol=2)[0]

    def result(self,task,**extra):
        return dict(target_id=str(self.target.id),execution_id=task['execution_id'],
            completed_at=timezone.now().isoformat(),status='up',response_time_ms=100,**extra)

    def test_lost_heartbeat_response_redelivers_same_execution_and_capacity_zero_reserves_nothing(self):
        self.assertEqual(AgentProbeService.process_heartbeat(self.probe,delivery_protocol=2,capacity=0),[])
        self.assertFalse(AgentExecution.objects.exists())
        task=self.issue()
        self.assertEqual(self.issue(),task)
        self.assertEqual(AgentExecution.objects.count(),1)
        self.assertEqual(AgentProbeService.process_heartbeat(self.probe,delivery_protocol=2,known_executions=[task['execution_id']]),[])

    def test_lost_ack_retry_creates_only_one_check(self):
        task=self.issue();result=self.result(task)
        self.assertEqual(ingest_batch(self.probe,[result])[0]['status'],'accepted')
        self.assertEqual(ingest_batch(self.probe,[result])[0]['status'],'duplicate')
        self.assertEqual(self.target.checks.count(),1)
        self.assertEqual(AgentExecution.objects.get().payload,{})

    def test_old_result_cannot_release_new_lease_or_overwrite_current_state(self):
        old=self.issue();completed=timezone.now()
        lease=ScanLease.objects.get()
        lease.pending_until=timezone.now()-timedelta(seconds=1)
        lease.next_allowed_at=timezone.now()-timedelta(seconds=1)
        lease.save()
        AgentExecution.objects.filter(pk=old['execution_id']).update(created_at=timezone.now()-timedelta(minutes=11))
        new=self.issue()
        self.assertNotEqual(new['execution_id'],old['execution_id'])
        ingest_batch(self.probe,[self.result(new)])
        latest=self.target.checks.get().checked_at
        result=self.result(old);result['completed_at']=(completed-timedelta(minutes=1)).isoformat();result['status']='down'
        self.assertEqual(ingest_batch(self.probe,[result])[0]['status'],'accepted')
        self.target.refresh_from_db()
        self.assertEqual(self.target.last_status,'up')
        self.assertEqual(self.target.last_checked_at,latest)
        self.assertEqual(self.target.checks.count(),2)

    def test_old_result_leaves_new_pending_reservation_intact(self):
        old=self.issue()
        ScanLease.objects.update(pending_until=timezone.now()-timedelta(seconds=1),next_allowed_at=timezone.now()-timedelta(seconds=1))
        AgentExecution.objects.update(created_at=timezone.now()-timedelta(minutes=11))
        new=self.issue()
        self.assertEqual(ingest_batch(self.probe,[self.result(old)])[0]['status'],'accepted')
        lease=ScanLease.objects.get()
        self.assertEqual(str(lease.token),new['execution_id'])
        self.assertIsNotNone(lease.pending_until)

    def test_foreign_probe_cannot_submit_or_read_receipt(self):
        task=self.issue()
        foreign=Organization.objects.create(name='Other',slug='delivery-other',beta_managed=False)
        _,token_hash=AgentProbe.generate_token()
        probe=AgentProbe.objects.create(organization=foreign,name='Other',token_hash=token_hash)
        self.assertEqual(ingest_batch(probe,[self.result(task)])[0]['reason'],'unknown_execution')
        self.assertFalse(self.target.checks.exists())

    def test_bad_item_does_not_discard_valid_item(self):
        task=self.issue()
        acknowledgements=ingest_batch(self.probe,[{'execution_id':str(uuid4())},self.result(task)])
        self.assertEqual([a['status'] for a in acknowledgements],['rejected','accepted'])

    def test_expired_disabled_and_clock_errors_are_terminal(self):
        task=self.issue();result=self.result(task)
        result['completed_at']=(timezone.now()+timedelta(hours=1)).isoformat()
        self.assertEqual(ingest_batch(self.probe,[result])[0]['reason'],'invalid_completion_time')
        self.target.enabled=False;self.target.save()
        self.assertEqual(ingest_batch(self.probe,[self.result(task)])[0]['reason'],'target_unavailable')
        AgentExecution.objects.update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(ingest_batch(self.probe,[self.result(task)])[0]['reason'],'expired_execution')

    def test_legacy_payload_cannot_consume_modern_reservation(self):
        self.issue()
        self.assertEqual(AgentProbeService.ingest_results(self.probe,[{'target_id':str(self.target.id),'status':'up','response_time_ms':100}]),0)
        self.assertFalse(self.target.checks.exists())

    def test_server_issued_policy_survives_configuration_change(self):
        task=self.issue()
        self.target.max_latency_ms=2000;self.target.save()
        result=self.result(task);result['response_time_ms']=600
        ingest_batch(self.probe,[result])
        check=self.target.checks.get()
        self.assertEqual(check.status,'slow')
        self.assertEqual(check.details['evaluation_policy']['max_latency_ms'],500)

    def test_http_contract_auth_capacity_and_acknowledgements(self):
        url='/api/v1/agent-probes/heartbeat/'
        self.assertEqual(self.client.post(url,{},format='json').status_code,401)
        self.client.credentials(HTTP_X_PROBE_TOKEN=self.token)
        self.assertEqual(self.client.post(url,{'delivery_protocol':2,'capacity':11},format='json').status_code,400)
        response=self.client.post(url,{'delivery_protocol':2,'capacity':1},format='json')
        self.assertEqual(response.status_code,200)
        task=response.data['data']['tasks'][0]
        response=self.client.post('/api/v1/agent-probes/submit-results/',{'delivery_protocol':2,'results':[self.result(task)]},format='json')
        self.assertEqual(response.data['data']['acknowledgements'][0]['status'],'accepted')

    def test_retention_deletes_only_expired_receipts_not_configurations(self):
        self.issue();AgentExecution.objects.update(expires_at=timezone.now()-timedelta(seconds=1))
        call_command('purge_telemetry',stdout=StringIO())
        self.assertFalse(AgentExecution.objects.exists())
        self.assertTrue(MonitoringTarget.objects.filter(pk=self.target.pk).exists())


class ConcurrentAgentDeliveryTests(TransactionTestCase):
    def test_concurrent_retries_commit_one_measurement(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        org=Organization.objects.create(name='Concurrent delivery',slug='concurrent-delivery',beta_managed=False)
        _,token_hash=AgentProbe.generate_token()
        probe=AgentProbe.objects.create(organization=org,name='LAN',token_hash=token_hash)
        target=MonitoringTarget.objects.create(organization=org,name='API',endpoint='https://example.test',runner_type='agent',agent_probe=probe)
        task=AgentProbeService.process_heartbeat(probe,delivery_protocol=2)[0]
        result={'target_id':str(target.id),'execution_id':task['execution_id'],
                'completed_at':timezone.now().isoformat(),'status':'up','response_time_ms':50}
        barrier=Barrier(2)
        def submit():
            close_old_connections()
            try:
                local_probe=AgentProbe.objects.get(pk=probe.id)
                barrier.wait(timeout=10)
                return ingest_batch(local_probe,[result])[0]['status']
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(lambda _:submit(),range(2)))
        self.assertCountEqual(results,['accepted','duplicate'])
        self.assertEqual(target.checks.count(),1)
