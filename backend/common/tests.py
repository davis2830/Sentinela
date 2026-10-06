import os
import runpy
import secrets
from unittest.mock import Mock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase
from django.conf import settings
from rest_framework.exceptions import ValidationError

from common import safe_http
from common.security import validate_safe_public_url


class ProductionSettingsTests(SimpleTestCase):
    def setUp(self):
        self.strong_key = secrets.token_urlsafe(64)

    def test_rejects_placeholder_secret_and_wildcard_host(self):
        with patch.dict(os.environ, {"SECRET_KEY": "change-me-in-production", "ALLOWED_HOSTS": "api.example.com"}):
            with self.assertRaises(ImproperlyConfigured):
                runpy.run_module("config.settings.prod")

        with patch.dict(os.environ, {"SECRET_KEY": self.strong_key, "ALLOWED_HOSTS": "*"}):
            with self.assertRaises(ImproperlyConfigured):
                runpy.run_module("config.settings.prod")

    def test_restricts_origins_and_requires_full_hsts_for_preload(self):
        values = {
            "SECRET_KEY": self.strong_key,
            "ALLOWED_HOSTS": "api.example.com",
            "CORS_ALLOWED_ORIGINS": "https://app.example.com",
            "SECURE_HSTS_SECONDS": "3600",
            "SECURE_HSTS_INCLUDE_SUBDOMAINS": "false",
            "SECURE_HSTS_PRELOAD": "false",
        }
        with patch.dict(os.environ, values):
            settings_module = runpy.run_module("config.settings.prod")
        self.assertFalse(settings_module["DEBUG"])
        self.assertEqual(settings_module["ALLOWED_HOSTS"], ["api.example.com"])
        self.assertFalse(settings_module["CORS_ALLOW_ALL_ORIGINS"])
        self.assertEqual(settings_module["CORS_ALLOWED_ORIGINS"], ["https://app.example.com"])
        self.assertEqual(settings_module["SECURE_HSTS_SECONDS"], 3600)

        values["SECURE_HSTS_PRELOAD"] = "true"
        with patch.dict(os.environ, values):
            with self.assertRaises(ImproperlyConfigured):
                runpy.run_module("config.settings.prod")


class OutboundSecurityTests(SimpleTestCase):
    def test_restricted_destinations_are_rejected(self):
        for url in ("http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.1/"):
            with self.subTest(url=url), self.assertRaises(ValidationError):
                validate_safe_public_url(url)

    @patch(
        "common.safe_http.resolve_safe_public_url",
        return_value=("https://example.com/start", "example.com", 443, ("93.184.216.34",)),
    )
    @patch("common.safe_http.requests.Session.request")
    def test_safe_client_pins_dns_and_never_follows_redirects(self, request_mock, _resolve_mock):
        request_mock.return_value = Mock(status_code=302, headers={"Location": "http://127.0.0.1/"})
        response = safe_http.get("https://example.com/start")
        self.assertEqual(response.status_code, 302)
        self.assertFalse(request_mock.call_args.kwargs["allow_redirects"])
        self.assertEqual(request_mock.call_args.kwargs["url"], "https://93.184.216.34:443/start")
        self.assertEqual(request_mock.call_args.kwargs["headers"]["Host"], "example.com")
        self.assertEqual(request_mock.call_count, 1)

    @patch("common.security.socket.getaddrinfo")
    def test_rejects_hostname_when_any_resolved_ip_is_private(self, getaddrinfo_mock):
        getaddrinfo_mock.return_value = [
            (2, 1, 6, "", ("93.184.216.34", 443)),
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]
        with self.assertRaises(ValidationError):
            validate_safe_public_url("https://example.com/")


class CeleryScheduleTests(SimpleTestCase):
    def test_every_periodic_task_is_registered(self):
        from config.celery import app

        app.loader.import_default_modules()
        missing = {
            entry["task"]
            for entry in settings.CELERY_BEAT_SCHEDULE.values()
            if entry["task"] not in app.tasks
        }
        self.assertEqual(missing, set())


class CeleryPeriodicExecutionTests(TestCase):
    def test_ssl_dns_and_whois_schedules_execute_directly(self):
        from dns_monitor.tasks import scan_all_dns_records
        from domain.tasks import scan_all_domains
        from ssl_monitor.tasks import scan_all_certificates

        self.assertIsNone(scan_all_certificates.run())
        self.assertIsNone(scan_all_dns_records.run())
        self.assertIsNone(scan_all_domains.run())
