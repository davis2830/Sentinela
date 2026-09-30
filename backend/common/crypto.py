"""
Cryptographic Utilities for Sentinel NOC (Encryption at Rest)
============================================================
Provides transparent field-level encryption for sensitive credentials,
authorization tokens, API keys, and custom headers stored in PostgreSQL.
Uses AES-128-CBC with HMAC-SHA256 authenticated encryption (Fernet specification).
"""

import base64
import hashlib
import os
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken

_ENCRYPTION_PREFIX = "enc:"
_SENSITIVE_KEY_SUBSTRINGS = (
    "auth",
    "token",
    "secret",
    "password",
    "api_key",
    "apikey",
    "bearer",
    "key",
    "credential",
    "private",
)


def _get_fernet() -> Fernet:
    """Derive a deterministic 32-byte URL-safe base64 key for Fernet."""
    explicit_key = os.environ.get("FIELD_ENCRYPTION_KEY", getattr(settings, "FIELD_ENCRYPTION_KEY", "")).strip()
    if explicit_key:
        try:
            # If already a valid 32-byte base64 key
            return Fernet(explicit_key.encode("utf-8"))
        except Exception:
            pass

    # Derive securely from Django's SECRET_KEY via SHA-256
    secret = getattr(settings, "SECRET_KEY", "sentinel-default-fallback-key-32b").encode("utf-8")
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(derived_key)


def encrypt_string(plaintext: str) -> str:
    """
    Encrypt a plaintext string.
    Returns string prefixed with 'enc:' for easy identification.
    """
    if not plaintext:
        return plaintext
    if isinstance(plaintext, str) and plaintext.startswith(_ENCRYPTION_PREFIX):
        return plaintext  # Already encrypted

    fernet = _get_fernet()
    encrypted_bytes = fernet.encrypt(str(plaintext).encode("utf-8"))
    return f"{_ENCRYPTION_PREFIX}{encrypted_bytes.decode('utf-8')}"


def decrypt_string(ciphertext: str) -> str:
    """
    Decrypt an encrypted string prefixed with 'enc:'.
    If not encrypted, returns original value unchanged (backward compatibility).
    """
    if not ciphertext or not isinstance(ciphertext, str):
        return ciphertext
    if not ciphertext.startswith(_ENCRYPTION_PREFIX):
        return ciphertext  # Plaintext legacy value

    raw_token = ciphertext[len(_ENCRYPTION_PREFIX):].encode("utf-8")
    fernet = _get_fernet()
    try:
        decrypted_bytes = fernet.decrypt(raw_token)
        return decrypted_bytes.decode("utf-8")
    except (InvalidToken, Exception):
        # Fallback if key mismatch occurs
        return ciphertext


def encrypt_secrets_dict(data: dict) -> dict:
    """
    Traverse a dictionary (e.g. custom_headers or auth_config) and encrypt
    the values of any keys that match sensitive patterns.
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for k, v in data.items():
        k_lower = str(k).lower()
        is_sensitive = any(sub in k_lower for sub in _SENSITIVE_KEY_SUBSTRINGS)
        if is_sensitive and isinstance(v, str):
            result[k] = encrypt_string(v)
        elif isinstance(v, dict):
            result[k] = encrypt_secrets_dict(v)
        else:
            result[k] = v
    return result


def decrypt_secrets_dict(data: dict) -> dict:
    """
    Traverse a dictionary and decrypt any values that start with 'enc:'.
    Used when executing HTTP requests, API checks, or dispatching tasks to probes.
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for k, v in data.items():
        if isinstance(v, str):
            result[k] = decrypt_string(v)
        elif isinstance(v, dict):
            result[k] = decrypt_secrets_dict(v)
        else:
            result[k] = v
    return result


def mask_secrets_dict(data: dict) -> dict:
    """
    Mask values of sensitive keys for safe display in serializers, API responses, and logs.
    Example: 'Bearer supersecret123' -> 'Bearer **********'
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for k, v in data.items():
        k_lower = str(k).lower()
        is_sensitive = any(sub in k_lower for sub in _SENSITIVE_KEY_SUBSTRINGS)
        if is_sensitive and isinstance(v, str):
            decrypted = decrypt_string(v)
            if decrypted.lower().startswith("bearer "):
                prefix = decrypted[:7]
                result[k] = f"{prefix}********"
            elif len(decrypted) > 6:
                result[k] = f"{decrypted[:2]}****{decrypted[-2:]}"
            else:
                result[k] = "********"
        elif isinstance(v, dict):
            result[k] = mask_secrets_dict(v)
        else:
            result[k] = v
    return result
