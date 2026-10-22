import importlib.util
import os
from pathlib import Path
import unittest
import sys
sys.path.insert(0, str(Path(__file__).parent))
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import time


class Handler(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.requests.append((self.path, self.headers.get('X-Probe-Token')))
        if self.path.startswith('/redirect/'):
            self.send_response(int(self.path.rsplit('/', 1)[1]))
            self.send_header('Location', '/destination')
        else:
            if self.path == '/slow':
                time.sleep(.15)
            self.send_response(200)
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.requests.append((self.path, body, self.headers.get('Authorization')))
        self.send_response(201)
        self.end_headers()

with patch.dict(os.environ, {'SENTININE_TOKEN':'isolated-test-only'}):
    spec=importlib.util.spec_from_file_location('agent_under_test',Path(__file__).with_name('agent.py'))
    agent=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(agent)

class EvaluationPolicyTests(unittest.TestCase):
    def test_limit_boundary_and_policy_snapshot(self):
        for ms, expected in [(499,'up'),(500,'up'),(577,'slow')]:
            with self.subTest(ms=ms), patch.object(agent,'_execute_target',return_value={'target_id':'fixture','status':'up','response_time_ms':ms}):
                result=agent.check_target({'max_latency_ms':500,'expected_status':200})
            self.assertEqual(result['status'],expected)
            self.assertEqual(result['evaluation_policy'],{'max_latency_ms':500,'expected_status':200})

    def test_http_failure_keeps_failure_even_with_short_attempt(self):
        with patch.object(agent,'_execute_target',return_value={'target_id':'fixture','status':'down','response_time_ms':173,'http_status':403}):
            result=agent.check_target({'max_latency_ms':500,'expected_status':200})
        self.assertEqual(result['status'],'down')
        self.assertEqual(result['evaluation_policy']['max_latency_ms'],500)


class ProtocolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        Handler.requests.clear()
        # Only fixture destinations bypass the production LAN boundary.
        boundary=patch('common.network.validate_target_addresses')
        boundary.start();self.addCleanup(boundary.stop)

    def task(self, path='/', **kwargs):
        return dict(target_id='fixture', endpoint=self.url+path, target_type='api', max_latency_ms=500, **kwargs)

    def test_post_sends_exact_body_headers_and_expected_code(self):
        body = '{"nombre":"prueba ñ"}'
        result = agent.check_target(self.task(http_method='POST', request_body=body, expected_status=201,
                                             custom_headers={'Authorization':'Bearer fixture-only', 'Content-Type':'application/json'}))
        self.assertEqual(result['status'], 'up')
        self.assertEqual(Handler.requests, [('/', body.encode(), 'Bearer fixture-only')])

    def test_redirects_never_visit_destination(self):
        for code in (301,302,303,307,308):
            with self.subTest(code=code):
                Handler.requests.clear()
                result=agent.check_target(self.task(f'/redirect/{code}'))
                self.assertEqual(result['http_status'], code)
                self.assertEqual(result['status'], 'down')
                self.assertEqual(len(Handler.requests), 1)

    def test_expected_redirect_is_success_without_following(self):
        self.assertEqual(agent.check_target(self.task('/redirect/308', expected_status=308))['status'], 'up')
        self.assertEqual(len(Handler.requests), 1)

    def test_control_redirect_does_not_forward_token(self):
        with patch.object(agent, 'SENTININE_SERVER', self.url+'/redirect/307'):
            # Use GET directly to exercise the shared transport with the control header.
            req=agent.urllib.request.Request(self.url+'/redirect/307', headers={'X-Probe-Token':'fixture'})
            with self.assertRaises(agent.urllib.error.HTTPError):
                agent.open_request(req, timeout=2)
        self.assertEqual(Handler.requests, [('/redirect/307','fixture')])

    def test_slow_response_is_not_connection_timeout(self):
        task=self.task('/slow');task['max_latency_ms']=50
        result=agent.check_target(task)
        self.assertEqual(result['status'], 'slow')
        self.assertEqual(result['http_status'], 200)

    def test_unsupported_protocol_never_reports_success(self):
        for protocol in ('ssl', 'unknown'):
            task=self.task();task['target_type']=protocol
            self.assertEqual(agent.check_target(task)['status'], 'error')
        self.assertFalse(Handler.requests)

    def test_invalid_body_is_isolated(self):
        self.assertEqual(agent.check_target(self.task(request_body={}))['status'], 'error')
        self.assertEqual(agent.check_target(self.task())['status'], 'up')

if __name__=='__main__':unittest.main()
