import json
import sqlite3
import tempfile
import threading
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from delivery import Journal, DeliveryRuntime, local_status


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.path=Path(self.directory.name)/'journal.sqlite3'
        self.journal=Journal(self.path)
        self.task={'target_id':str(uuid.uuid4()),'execution_id':str(uuid.uuid4()),
                   'run_before':(datetime.now(timezone.utc)+timedelta(minutes=10)).isoformat(),
                   'custom_headers':{'Authorization':'fixture-secret'}}

    def tearDown(self):
        self.directory.cleanup()

    def runtime(self,check=None,heartbeat=None,submit=None):
        return DeliveryRuntime(self.journal,check or Mock(return_value={'status':'up','response_time_ms':50,'target_id':self.task['target_id']}),
            heartbeat or Mock(),submit or Mock(),Mock())

    def ready(self):
        runtime=self.runtime();self.journal.enqueue([self.task]);runtime.execute(self.task)
        return self.journal.results()[0]

    def test_result_survives_restart_and_network_failure(self):
        result=self.ready()
        self.journal=Journal(self.path)
        runtime=self.runtime(submit=Mock(side_effect=OSError('offline')))
        with self.assertRaises(OSError):runtime.deliver_once()
        self.assertEqual(self.journal.results(),[result])

    def test_lost_ack_duplicate_confirmation_removes_only_confirmed_result(self):
        self.ready()
        submit=Mock(side_effect=[{'ingested_count':1},{'acknowledgements':[{'execution_id':self.task['execution_id'],'status':'duplicate'}]}])
        runtime=self.runtime(submit=submit)
        with self.assertRaises(ValueError):runtime.deliver_once()
        self.assertEqual(len(self.journal.results()),1)
        runtime.deliver_once()
        self.assertEqual(self.journal.results(),[])

    def test_no_automatic_reexecution_after_running_process_crash(self):
        self.journal.enqueue([self.task]);self.journal.claim(self.task['execution_id'])
        recovered=Journal(self.path)
        self.assertEqual(recovered.tasks('queued'),[])
        result=recovered.results()[0]
        self.assertEqual(result['status'],'error')
        self.assertIn('interrumpida',result['error_message'])
        self.assertNotIn('fixture-secret',json.dumps(result))

    def test_redelivery_deduplicates_local_jobs(self):
        self.journal.enqueue([self.task,self.task])
        runtime=self.runtime()
        runtime.execute(self.task);runtime.execute(self.task)
        self.assertEqual(runtime.check.call_count,1)

    def test_delayed_heartbeat_after_ack_cannot_reexecute_endpoint(self):
        self.ready();identifier=self.task['execution_id']
        self.journal.acknowledge([{'execution_id':identifier,'status':'accepted'}],{identifier})
        recovered=Journal(self.path)
        recovered.enqueue([self.task])
        self.assertFalse(recovered.tasks('queued'))
        self.assertFalse(recovered.known())

    def test_status_is_read_only_and_never_recovers_running_job_or_exposes_secrets(self):
        self.journal.enqueue([self.task]);self.journal.claim(self.task['execution_id'])
        status=local_status(self.path.parent)
        self.assertEqual(status['running'],1)
        self.assertEqual(status['pending'],1)
        self.assertNotIn('fixture-secret',json.dumps(status))
        self.assertEqual(len(self.journal.tasks('running')),1)

    def test_drain_heartbeat_advertises_zero_capacity(self):
        called=threading.Event()
        requests=[]
        def heartbeat(**kwargs):
            requests.append(kwargs);called.set()
            return {'delivery_protocol':2,'tasks':[]}
        runtime=self.runtime(heartbeat=heartbeat);runtime.draining=lambda:True
        thread=threading.Thread(target=runtime.heartbeat_loop);thread.start()
        try:
            self.assertTrue(called.wait(2))
            self.assertEqual(requests[0]['capacity'],0)
        finally:
            runtime.stop.set();thread.join(3)

    def test_bounded_queue_preserves_pending_results_and_backpressure(self):
        self.journal=Journal(self.path,limit=1)
        original=self.ready()
        self.assertEqual(self.journal.capacity(),0)
        with self.assertRaises(RuntimeError):
            self.journal.enqueue([{**self.task,'execution_id':str(uuid.uuid4())}])
        self.assertEqual(self.journal.results(),[original])

    def test_foreign_or_unknown_ack_never_deletes_result(self):
        self.ready()
        identifier=self.task['execution_id']
        self.journal.acknowledge([{'execution_id':identifier,'status':'accepted'}],set())
        self.journal.acknowledge([{'execution_id':identifier,'status':'retry'}],{identifier})
        self.assertEqual(len(self.journal.results()),1)

    def test_terminal_rejection_is_retained_for_diagnosis(self):
        self.ready();identifier=self.task['execution_id']
        self.journal.acknowledge([{'execution_id':identifier,'status':'rejected','reason':'expired_execution'}],{identifier})
        self.assertFalse(self.journal.results())
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT reason FROM rejected').fetchone()[0],'expired_execution')

    def test_telemetry_counts_and_ack_survive_restart_without_payload(self):
        self.journal.enqueue([self.task])
        runtime = self.runtime()
        self.assertEqual(runtime.telemetry()['queue']['queued'], 1)
        runtime.execute(self.task)
        self.assertEqual(runtime.telemetry()['queue']['ready'], 1)
        self.assertIsNone(runtime.telemetry()['last_ack_at'])
        runtime.submit = Mock(return_value={'acknowledgements': [
            {'execution_id': self.task['execution_id'], 'status': 'duplicate'}]})
        runtime.deliver_once()
        snapshot = self.runtime().telemetry()
        self.assertEqual(snapshot['queue'], {'queued': 0, 'running': 0, 'ready': 0})
        self.assertIsNotNone(snapshot['last_ack_at'])
        self.assertEqual(Journal(self.path).snapshot()['last_ack_at'], snapshot['last_ack_at'])
        self.assertNotIn('fixture-secret', json.dumps(snapshot))

    def test_delivery_failure_is_structured_and_clears_only_after_full_ack(self):
        self.ready()
        runtime = self.runtime(submit=Mock(side_effect=OSError('private-token-secret')))
        with self.assertRaises(OSError): runtime.deliver_once()
        snapshot = runtime.telemetry()
        self.assertEqual(snapshot['errors'][0]['code'], 'delivery_unconfirmed')
        self.assertNotIn('private-token-secret', json.dumps(snapshot))
        runtime.submit = Mock(return_value={'acknowledgements': []})
        with self.assertRaises(ValueError): runtime.deliver_once()
        self.assertEqual(runtime.telemetry()['errors'][0]['code'], 'receipt_incomplete')
        runtime.submit = Mock(return_value={'acknowledgements': [
            {'execution_id': self.task['execution_id'], 'status': 'accepted'}]})
        runtime.deliver_once()
        self.assertEqual(runtime.telemetry()['errors'], [])

    def test_rejection_is_historical_and_not_a_successful_ack(self):
        self.ready()
        runtime = self.runtime(submit=Mock(return_value={'acknowledgements': [
            {'execution_id': self.task['execution_id'], 'status': 'rejected', 'reason': 'expired_execution'}]}))
        runtime.deliver_once()
        snapshot = runtime.telemetry()
        self.assertEqual(snapshot['rejected_retained'], 1)
        self.assertIsNotNone(snapshot['last_rejection_at'])
        self.assertIsNone(snapshot['last_ack_at'])
        self.assertEqual(snapshot['errors'], [])

    def test_storage_failure_still_reports_heartbeat_with_zero_capacity(self):
        calls = []
        runtime = self.runtime()
        def heartbeat(**kwargs):
            calls.append(kwargs)
            runtime.stop.set()
            return {'delivery_protocol': 2, 'tasks': []}
        runtime.heartbeat = heartbeat
        with patch.object(self.journal, 'snapshot', side_effect=sqlite3.OperationalError('secret-path')):
            runtime.heartbeat_loop()
        self.assertEqual(calls[0]['capacity'], 0)
        snapshot = calls[0]['telemetry']
        self.assertIsNone(snapshot['queue'])
        self.assertEqual(snapshot['errors'][0]['code'], 'local_storage')
        self.assertNotIn('secret-path', json.dumps(snapshot))

    def test_storage_error_cannot_clear_until_a_write_succeeds(self):
        runtime = self.runtime()
        runtime.set_error('storage', 'local_storage')
        # Reading counters alone must not label a read-only/full disk as recovered.
        self.assertEqual(runtime.telemetry()['errors'][0]['code'], 'local_storage')
        with patch.object(self.journal, 'connect', side_effect=sqlite3.OperationalError('read only')):
            with self.assertRaises(sqlite3.OperationalError): runtime.recover_storage()
        self.assertEqual(runtime.telemetry()['errors'][0]['code'], 'local_storage')
        runtime.recover_storage()
        self.assertEqual(runtime.telemetry()['errors'], [])

    def test_expired_task_never_calls_endpoint(self):
        self.task['run_before']=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()
        self.journal.enqueue([self.task]);runtime=self.runtime();runtime.execute(self.task)
        runtime.check.assert_not_called()
        self.assertEqual(self.journal.results()[0]['status'],'error')

    def test_heartbeat_continues_while_checker_and_sender_are_blocked(self):
        checker_started=threading.Event();sender_started=threading.Event();release=threading.Event();heartbeats=threading.Event()
        self.ready()
        pending={**self.task,'execution_id':str(uuid.uuid4())}
        self.journal.enqueue([pending])
        count=[]
        def check(task):
            checker_started.set();release.wait(5)
            return {'target_id':task['target_id'],'status':'up','response_time_ms':50}
        def submit(results):
            sender_started.set();release.wait(5)
            return {'acknowledgements':[]}
        def heartbeat(**kwargs):
            count.append(kwargs)
            if len(count)>=2:heartbeats.set()
            return {'delivery_protocol':2,'tasks':[],'poll_interval_seconds':1}
        runtime=self.runtime(check,heartbeat,submit)
        runtime.start()
        try:
            self.assertTrue(checker_started.wait(2))
            self.assertTrue(sender_started.wait(2))
            self.assertTrue(heartbeats.wait(3),'Heartbeat must not wait for probes or result delivery')
            self.assertIn(pending['execution_id'],count[-1]['known_executions'])
        finally:
            release.set();runtime.close()


if __name__=='__main__':unittest.main()
