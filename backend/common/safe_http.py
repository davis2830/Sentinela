"""Centralized outbound HTTP client with SSRF protections.

Every cloud-originated HTTP request must pass through this module. Destinations
are resolved and every returned address is validated immediately before the
connection is opened. Redirects are deliberately never followed.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit, urlunsplit

import requests
from requests.adapters import HTTPAdapter

from .security import resolve_safe_public_url


DEFAULT_TIMEOUT_SECONDS = (5, 15)


class _PinnedHTTPSAdapter(HTTPAdapter):
    """Use a validated IP while verifying TLS against the original hostname."""

    def __init__(self, server_hostname: str, *args: Any, **kwargs: Any) -> None:
        self.server_hostname = server_hostname
        super().__init__(*args, **kwargs)

    def init_poolmanager(self, connections: int, maxsize: int, block: bool = False, **pool_kwargs: Any) -> None:
        pool_kwargs["assert_hostname"] = self.server_hostname
        pool_kwargs["server_hostname"] = self.server_hostname
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


def _ip_netloc(ip_address: str, port: int) -> str:
    host = f"[{ip_address}]" if ":" in ip_address else ip_address
    return f"{host}:{port}"


def _host_header(hostname: str, port: int, scheme: str) -> str:
    host = f"[{hostname}]" if ":" in hostname else hostname
    default_port = 443 if scheme == "https" else 80
    return host if port == default_port else f"{host}:{port}"


def request(method: str, url: str, **kwargs: Any) -> requests.Response:
    """Send one request to a validated public HTTP(S) destination.

    The response may be a redirect. Callers can expose its ``Location`` header
    to an operator, but must not visit that location automatically.
    """

    safe_url, hostname, port, resolved_ips = resolve_safe_public_url(url)
    parsed = urlsplit(safe_url)
    pinned_url = urlunsplit(
        (parsed.scheme, _ip_netloc(resolved_ips[0], port), parsed.path, parsed.query, "")
    )

    kwargs.pop("allow_redirects", None)
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT_SECONDS)
    kwargs["allow_redirects"] = False
    headers = dict(kwargs.pop("headers", {}) or {})
    headers["Host"] = _host_header(hostname, port, parsed.scheme)

    session = requests.Session()
    session.trust_env = False
    if parsed.scheme == "https":
        session.mount("https://", _PinnedHTTPSAdapter(hostname))

    try:
        response = session.request(
            method=method.upper(),
            url=pinned_url,
            headers=headers,
            **kwargs,
        )
        response.url = safe_url
        return response
    finally:
        session.close()


def get(url: str, **kwargs: Any) -> requests.Response:
    return request("GET", url, **kwargs)


def post(url: str, **kwargs: Any) -> requests.Response:
    return request("POST", url, **kwargs)
