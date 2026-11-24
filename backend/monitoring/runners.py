"""Target monitoring check runners implementing the Open/Closed Principle (OCP).

Adding a new target type (e.g. gRPC, ICMP ping, WebSocket) only requires
defining a new runner adhering to CheckRunner and registering it in check_runner_registry().
"""

from __future__ import annotations

import logging
import socket
import ssl as ssl_module
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from time import perf_counter
from typing import TYPE_CHECKING, Any, Protocol

from django.utils import timezone

from common import safe_http
from common.security import resolve_safe_target_endpoint

if TYPE_CHECKING:
    from .models import MonitoringTarget

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CheckResult:
    status: str
    latency: float | None
    details: dict[str, Any]


class CheckRunner(Protocol):
    @staticmethod
    def run(target: MonitoringTarget) -> CheckResult:
        """Execute the probe check against the specified target."""
        ...


class HTTPCheckRunner:
    """Execute the configured HTTP/HTTPS/API request through the pinned, no-redirect client."""

    @staticmethod
    def run(target: MonitoringTarget) -> CheckResult:
        url = target.endpoint
        if "://" not in url:
            url = f"https://{url}"
        method = (target.http_method or "GET").upper()
        start = perf_counter()
        try:
            with safe_http.request(
                method=method,
                url=url,
                headers=dict(target.custom_headers or {}),
                data=target.request_body.encode("utf-8") if target.request_body else None,
                timeout=(5, 10),
                stream=True,
            ) as response:
                latency_ms = (perf_counter() - start) * 1000
                code = response.status_code
            status = "down" if code != target.expected_status else ("slow" if latency_ms > target.max_latency_ms else "up")
            return CheckResult(
                status=status,
                latency=round(latency_ms, 2),
                details={
                    "status_code": code,
                    "expected_status": target.expected_status,
                    "method": method,
                    "url": url,
                },
            )
        except Exception as exc:
            return CheckResult(
                status="down",
                latency=None,
                details={"error": type(exc).__name__, "method": method, "url": url},
            )


class TCPCheckRunner:
    """Connect only to a public IP obtained by the security resolver."""

    @staticmethod
    def run(target: MonitoringTarget) -> CheckResult:
        _, _, port, resolved_ips = resolve_safe_target_endpoint(target.endpoint, allow_private=False)
        start = perf_counter()
        try:
            with socket.create_connection((resolved_ips[0], port), timeout=10):
                latency_ms = (perf_counter() - start) * 1000
            return CheckResult(
                status=("slow" if latency_ms > target.max_latency_ms else "up"),
                latency=round(latency_ms, 2),
                details={"endpoint": target.endpoint},
            )
        except Exception as exc:
            return CheckResult(
                status="down",
                latency=None,
                details={"error": type(exc).__name__, "endpoint": target.endpoint},
            )


class DNSCheckRunner:
    """Perform a DNS resolution check."""

    @staticmethod
    def run(target: MonitoringTarget) -> CheckResult:
        endpoint = target.endpoint.strip()
        if "://" in endpoint:
            endpoint = endpoint.split("://")[1]
        host = endpoint.split("/")[0].split(":")[0]
        start = timezone.now()
        try:
            _, _, _, resolved_ips = resolve_safe_target_endpoint(
                f"http://{host}",
                allow_private=False,
            )
            elapsed = (timezone.now() - start).total_seconds() * 1000
            addresses = list(resolved_ips)
            return CheckResult(
                status="up",
                latency=round(elapsed, 2),
                details={"addresses": addresses, "host": host},
            )
        except socket.gaierror as exc:
            return CheckResult(
                status="down",
                latency=None,
                details={"error": str(exc), "domain": host},
            )


class SSLCheckRunner:
    """Perform an SSL certificate check for a monitoring target."""

    @staticmethod
    def run(target: MonitoringTarget) -> CheckResult:
        endpoint = target.endpoint.strip()
        if "://" in endpoint:
            endpoint = endpoint.split("://")[1]
        host = endpoint.split("/")[0].split(":")[0]

        start = timezone.now()
        try:
            _, tls_hostname, port, resolved_ips = resolve_safe_target_endpoint(
                f"https://{host}",
                allow_private=False,
            )
            context = ssl_module.create_default_context()
            with socket.create_connection((resolved_ips[0], port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=tls_hostname) as ssock:
                    cert_info = ssock.getpeercert()

            elapsed = (timezone.now() - start).total_seconds() * 1000

            issuer_info = dict(x[0] for x in cert_info.get("issuer", []))
            issuer_name = issuer_info.get("organizationName") or issuer_info.get("commonName") or "Unknown"

            not_after = cert_info.get("notAfter", "")
            expiration_date = None
            days_remaining = None
            if not_after:
                try:
                    expiration_date = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt_timezone.utc)
                    now = datetime.now(dt_timezone.utc)
                    days_remaining = (expiration_date - now).days
                except ValueError:
                    pass

            status = "up"
            if elapsed > (target.max_latency_ms or 2000):
                status = "slow"

            return CheckResult(
                status=status,
                latency=round(elapsed, 2),
                details={
                    "host": host,
                    "days_remaining": days_remaining,
                    "issuer": issuer_name,
                    "expiration_date": expiration_date.isoformat() if expiration_date else None,
                },
            )
        except Exception as exc:
            return CheckResult(
                status="down",
                latency=None,
                details={"error": type(exc).__name__, "host": host},
            )


def check_runner_registry() -> dict[str, type[CheckRunner]]:
    """Return the allowlisted check runner registry mapping target types to runner classes."""
    return {
        "http": HTTPCheckRunner,
        "https": HTTPCheckRunner,
        "api": HTTPCheckRunner,
        "tcp": TCPCheckRunner,
        "dns": DNSCheckRunner,
        "ssl": SSLCheckRunner,
    }


def run_target_check(target: MonitoringTarget) -> CheckResult:
    """Execute the appropriate check runner for a target based on its target_type."""
    runner = check_runner_registry().get(target.target_type)
    if runner is None:
        raise ValueError(f"Unsupported target type: {target.target_type}")
    return runner.run(target)
