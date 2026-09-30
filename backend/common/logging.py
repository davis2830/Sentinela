"""
Log Sanitization and Masking Filter for Sentinel NOC
===================================================
AppSec Compliance (ISO 27001 / SOC 2):
Automatically masks passwords, bearer tokens, API keys, and sensitive
parameters from all log streams (stdout, Celery workers, Loki, Sentry).
"""

import logging
import re

_SENSITIVE_PATTERNS = [
    # Bearer tokens (JWT / Authorization headers)
    (re.compile(r'(?i)(bearer\s+)[A-Za-z0-9_\-\.]{15,}'), r'\1[REDACTED_JWT]'),
    # Sentinel Live Probe tokens (snt_live_... / snt_...)
    (re.compile(r'snt_[A-Za-z0-9_\-]{16,}'), 'snt_[REDACTED_TOKEN]'),
    # Passwords in JSON / query params / form data
    (re.compile(r'(?i)("password"\s*:\s*)"[^"]+"'), r'\1"[REDACTED_PASSWORD]"'),
    (re.compile(r'(?i)(password=)[^\s&,]+'), r'\1[REDACTED_PASSWORD]'),
    # Secrets & API Keys
    (re.compile(r'(?i)("secret"\s*:\s*)"[^"]+"'), r'\1"[REDACTED_SECRET]"'),
    (re.compile(r'(?i)("totp_secret"\s*:\s*)"[^"]+"'), r'\1"[REDACTED_TOTP]"'),
    (re.compile(r'(?i)("api_key"\s*:\s*)"[^"]+"'), r'\1"[REDACTED_APIKEY]"'),
]


class SensitiveDataMaskingFilter(logging.Filter):
    """
    Sanitizes log records before they are emitted to console or external sinks.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                for pattern, repl in _SENSITIVE_PATTERNS:
                    record.msg = pattern.sub(repl, record.msg)
            if record.args:
                sanitized_args = []
                for arg in record.args:
                    if isinstance(arg, str):
                        for pattern, repl in _SENSITIVE_PATTERNS:
                            arg = pattern.sub(repl, arg)
                    sanitized_args.append(arg)
                record.args = tuple(sanitized_args)
        except Exception:
            pass  # Avoid log filter exceptions halting execution
        return True
