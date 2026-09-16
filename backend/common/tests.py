import os
import runpy
import secrets
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase


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
            settings = runpy.run_module("config.settings.prod")
        self.assertFalse(settings["DEBUG"])
        self.assertEqual(settings["ALLOWED_HOSTS"], ["api.example.com"])
        self.assertFalse(settings["CORS_ALLOW_ALL_ORIGINS"])
        self.assertEqual(settings["CORS_ALLOWED_ORIGINS"], ["https://app.example.com"])
        self.assertEqual(settings["SECURE_HSTS_SECONDS"], 3600)

        values["SECURE_HSTS_PRELOAD"] = "true"
        with patch.dict(os.environ, values):
            with self.assertRaises(ImproperlyConfigured):
                runpy.run_module("config.settings.prod")
