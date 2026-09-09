import ipaddress
import socket
from urllib.parse import urlparse


class SSRFSecurityException(Exception):
    """Exception raised when a requested target/URL points to internal or restricted networks."""
    pass


FORBIDDEN_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "db",
    "database",
    "postgres",
    "timescaledb",
    "redis",
    "backend",
    "frontend",
    "celery_worker",
    "celery_beat",
    "alloy",
    "grafana",
    "prometheus",
    "host.docker.internal",
    "gateway.docker.internal",
    "kubernetes.default",
    "kubernetes.default.svc",
    "metadata.google.internal",
    "instance-data",
}


def validate_safe_public_url(url_or_target: str) -> str:
    """Validate that a URL or hostname is safe for outbound scanning/testing.

    Guards against Server-Side Request Forgery (SSRF) targeting:
    - Internal loopback (127.0.0.0/8, ::1)
    - Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
    - Cloud instance metadata services (169.254.169.254, fe80::/10)
    - Internal Docker/Kubernetes container service names

    Returns:
        The validated target/URL string.

    Raises:
        SSRFSecurityException: If the target is internal, invalid, or resolves to a private IP.
    """
    if not url_or_target or not isinstance(url_or_target, str):
        raise SSRFSecurityException("URL o destino no proporcionado.")

    raw = url_or_target.strip()
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")

    # Enforce safe schemes
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFSecurityException(
            f"Esquema de protocolo no permitido: '{parsed.scheme}'. Solo se admiten HTTP y HTTPS."
        )

    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityException("No se pudo determinar el nombre de host del objetivo.")

    hostname_clean = hostname.strip().lower()

    # Block well-known internal hostnames
    if hostname_clean in FORBIDDEN_HOSTNAMES or hostname_clean.endswith(".internal") or hostname_clean.endswith(".local"):
        raise SSRFSecurityException(
            f"El destino '{hostname}' apunta a un servicio de red interno o reservado y no puede ser sondeado."
        )

    # Resolve hostname to IP addresses and verify none are private/loopback/cloud metadata
    try:
        addr_infos = socket.getaddrinfo(hostname_clean, None)
    except socket.gaierror:
        raise SSRFSecurityException(
            f"No fue posible resolver la dirección del host '{hostname}'. Verifica que el dominio exista."
        )
    except Exception as exc:
        raise SSRFSecurityException(f"Error al verificar la dirección del host: {str(exc)}")

    for info in addr_infos:
        ip_str = info[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            raise SSRFSecurityException(f"Dirección IP no válida detectada: '{ip_str}'.")

        # Check all dangerous IP address ranges
        if (
            ip_obj.is_loopback
            or ip_obj.is_private
            or ip_obj.is_link_local
            or ip_obj.is_reserved
            or ip_obj.is_multicast
            or ip_obj.is_unspecified
        ):
            raise SSRFSecurityException(
                f"Destino restringido: '{hostname}' resuelve a una dirección privada/reservada ({ip_str}) "
                "que está bloqueada para prevenir ataques SSRF y proteger la infraestructura."
            )

    return raw
