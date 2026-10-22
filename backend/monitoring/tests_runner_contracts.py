"""Tenant boundaries and HTTP execution against an isolated local server."""
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from alerts.services import AlertEvaluatorService
from organizations.models import Organization
from .models import MaintenanceWindow, MonitoringTarget
from .tasks import _run_http_check, _run_tcp_check


class LegacyMaintenanceIsolation(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Runner contracts', slug='runner-contracts')
        self.foreign = Organization.objects.create(name='Other runner', slug='other-runner')
        self.admin = User.objects.create_user('admin@runner.example.test', organization=self.org,
                                              is_staff=True, email_verified_at=timezone.now())
        self.source = MonitoringTarget.objects.create(organization=self.org, name='Own', enabled=False)
        self.destination = MonitoringTarget.objects.create(organization=self.foreign, name='Foreign', enabled=False)
        self.window = MaintenanceWindow.objects.create(target=self.source, name='Window',
            start_time=timezone.now(), end_time=timezone.now() + timedelta(hours=1))
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_patch_cannot_move_window_to_foreign_target(self):
        for root in ('monitoring', 'monitoring-targets'):
            response = self.client.patch(f'/api/v1/{root}/maintenance-windows/{self.window.pk}/',
                                         {'target': str(self.destination.pk)}, format='json')
            self.assertEqual(response.status_code, 400)
        self.window.refresh_from_db()
        self.assertEqual(self.window.target_id, self.source.pk)
        self.assertFalse(AlertEvaluatorService._is_target_in_maintenance(self.destination))

    def test_creation_binds_to_scoped_url_and_regular_edit_still_works(self):
        response = self.client.post(f'/api/v1/monitoring/{self.source.pk}/maintenance-windows/', {
            'name': 'New', 'target': str(self.destination.pk),
            'start_time': timezone.now().isoformat(),
            'end_time': (timezone.now() + timedelta(hours=1)).isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data['data']['target']), str(self.source.pk))
        response = self.client.patch(f'/api/v1/monitoring/maintenance-windows/{self.window.pk}/',
                                     {'name': 'Updated', 'active': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.window.refresh_from_db()
        self.assertFalse(self.window.active)
        self.assertEqual(self.window.name, 'Updated')

    def test_foreign_patch_delete_hidden_and_viewer_cannot_mutate(self):
        window = MaintenanceWindow.objects.create(target=self.destination, name='Foreign window',
            start_time=timezone.now(), end_time=timezone.now() + timedelta(hours=1))
        url = f'/api/v1/monitoring/maintenance-windows/{window.pk}/'
        self.assertEqual(self.client.patch(url, {'active': False}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        viewer = User.objects.create_user('viewer@runner.example.test', organization=self.org)
        self.client.force_authenticate(viewer)
        url = f'/api/v1/monitoring/maintenance-windows/{self.window.pk}/'
        self.assertEqual(self.client.patch(url, {'active': False}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)


class CloudHTTPContracts(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.received = []
        received = cls.received

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
                received.append((self.command, self.path, dict(self.headers), body))
                self.send_response(302 if self.path == '/redirect' else 200 if self.path == '/unbounded' else 204)
                self.send_header('Location', 'http://127.0.0.1/private')
                self.send_header('Content-Length', '1000000000' if self.path == '/unbounded' else '0')
                self.end_headers()

            do_PUT = do_POST = do_PATCH = do_DELETE = do_HEAD = do_OPTIONS = do_GET

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        super().tearDownClass()

    def target(self, path='/check', **overrides):
        fields = dict(endpoint=f'http://probe.example.test:{self.server.server_port}{path}',
            http_method='PUT', expected_status=204, custom_headers={'X-Contract-Probe': 'audit-only'},
            request_body='contenido-á', max_latency_ms=2000)
        return SimpleNamespace(**(fields | overrides))

    def execute(self, target, elapsed=None):
        # The loopback exception exists only in this fixture's resolver.
        resolved = (target.endpoint, 'probe.example.test', self.server.server_port, ('127.0.0.1',))
        with patch('common.safe_http.resolve_safe_public_url', return_value=resolved) as resolve:
            if elapsed:
                with patch('monitoring.tasks.perf_counter', side_effect=elapsed):
                    result = _run_http_check(target)
            else:
                result = _run_http_check(target)
        resolve.assert_called_once_with(target.endpoint)
        return result

    def test_configured_http_header_and_body_reach_execution(self):
        for method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'):
            with self.subTest(method=method):
                status, _, details = self.execute(self.target(http_method=method))
                self.assertEqual(status, 'up')
                self.assertEqual(details['status_code'], 204)
                sent_method, _, headers, body = self.received[-1]
                self.assertEqual(sent_method, method)
                self.assertEqual(headers['X-Contract-Probe'], 'audit-only')
                self.assertEqual(headers['Host'], f'probe.example.test:{self.server.server_port}')
                self.assertEqual(body, 'contenido-á'.encode('utf-8'))

    def test_expected_code_and_latency_determine_status(self):
        self.assertEqual(self.execute(self.target(expected_status=200))[0], 'down')
        status, latency, _ = self.execute(self.target(max_latency_ms=500), elapsed=[10, 10.8])
        self.assertEqual((status, latency), ('slow', 800))

    def test_redirect_is_recorded_without_visiting_location(self):
        before = len(self.received)
        status, _, details = self.execute(self.target('/redirect'))
        self.assertEqual((status, details['status_code']), ('down', 302))
        self.assertEqual(len(self.received), before + 1)

    def test_http_does_not_download_response_body(self):
        self.assertEqual(self.execute(self.target('/unbounded', expected_status=200))[0], 'up')

    def test_configurable_http_uses_safe_client_and_blocks_private_destination(self):
        with patch('common.safe_http.requests.Session.request') as network:
            self.assertEqual(_run_http_check(self.target(endpoint='http://127.0.0.1/private'))[0], 'down')
            network.assert_not_called()


class CloudTCPContracts(SimpleTestCase):
    def test_connects_to_validated_ip_and_preserves_port(self):
        target = SimpleNamespace(endpoint='tcp.example.test:5432', max_latency_ms=500)
        addresses = [(2, 1, 6, '', ('8.8.8.8', 5432))]
        with patch('common.security.socket.getaddrinfo', return_value=addresses) as dns, \
             patch('monitoring.tasks.socket.create_connection') as connect:
            self.assertEqual(_run_tcp_check(target)[0], 'up')
            connect.assert_called_once_with(('8.8.8.8', 5432), timeout=10)
            dns.assert_called_once()

    def test_rejects_mixed_public_private_resolution_without_connecting(self):
        addresses = [(2, 1, 6, '', ('8.8.8.8', 5432)), (2, 1, 6, '', ('10.0.0.1', 5432))]
        with patch('common.security.socket.getaddrinfo', return_value=addresses), \
             patch('monitoring.tasks.socket.create_connection') as connect:
            with self.assertRaises(ValidationError):
                _run_tcp_check(SimpleNamespace(endpoint='changing.example.test:5432', max_latency_ms=500))
            connect.assert_not_called()
