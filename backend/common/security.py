"""
Security Utilities for Sentinel NOC
==================================
Includes anti-SSRF (Server-Side Request Forgery) protection, IP validation,
and network boundary checks for monitoring targets and API checks.
"""

import ipaddress
import socket
from urllib.parse import ParseResult, urlparse
from rest_framework.exceptions import ValidationError


class SSRFSecurityException(ValidationError):
    """Exception raised when an endpoint violates SSRF boundaries."""
    pass

# Restricted IP networks that must never be probed by Sentinel Cloud Workers
RESTRICTED_IPV4_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network (only valid as source address)
    ipaddress.ip_network("10.0.0.0/8"),          # Private-Use (RFC 1918)
    ipaddress.ip_network("100.64.0.0/10"),       # Shared Address Space (Carrier-grade NAT)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback (RFC 1122)
    ipaddress.ip_network("169.254.0.0/16"),      # Link-Local (Cloud metadata e.g. AWS 169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),       # Private-Use (RFC 1918)
    ipaddress.ip_network("192.0.0.0/24"),        # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),        # Documentation (TEST-NET-1)
    ipaddress.ip_network("192.168.0.0/16"),      # Private-Use (RFC 1918)
    ipaddress.ip_network("198.18.0.0/15"),       # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),     # Documentation (TEST-NET-2)
    ipaddress.ip_network("203.0.113.0/24"),      # Documentation (TEST-NET-3)
    ipaddress.ip_network("224.0.0.0/4"),         # Multicast
    ipaddress.ip_network("240.0.0.0/4"),         # Reserved for Future Use
    ipaddress.ip_network("255.255.255.255/32"),  # Broadcast
]

RESTRICTED_IPV6_NETWORKS = [
    ipaddress.ip_network("::1/128"),             # Loopback
    ipaddress.ip_network("::/128"),              # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),       # IPv4-mapped IPv6
    ipaddress.ip_network("64:ff9b::/96"),        # IPv4/IPv6 translation
    ipaddress.ip_network("100::/64"),            # Discard-only prefix
    ipaddress.ip_network("2001:db8::/32"),       # Documentation
    ipaddress.ip_network("fc00::/7"),            # Unique Local Address (ULA)
    ipaddress.ip_network("fe80::/10"),           # Link-Local Unicast (Cloud metadata)
    ipaddress.ip_network("ff00::/8"),            # Multicast
]

# Explicit cloud metadata hostnames to reject
CLOUD_METADATA_HOSTS = {
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
}


def is_ip_restricted(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address, allow_private: bool = False) -> tuple[bool, str]:
    """Check if an IP address falls into restricted or dangerous ranges."""
    # Always block loopback and cloud metadata link-local regardless of allow_private
    if ip_obj.is_loopback:
        return True, "No se permiten direcciones de loopback (127.0.0.1 / localhost)."
    
    if ip_obj.is_link_local or str(ip_obj) == "169.254.169.254":
        return True, "Acceso prohibido: La dirección IP 169.254.169.254 o link-local es un vector crítico de seguridad (Cloud Metadata)."

    if ip_obj.is_unspecified or ip_obj.is_multicast:
        return True, f"La dirección IP {ip_obj} no es enrutable o es multicast."

    if not allow_private:
        if not ip_obj.is_global:
            return True, (
                f"La dirección IP {ip_obj} no es globalmente enrutable. "
                "Los destinos internos deben ejecutarse mediante un Guardián Sentinine."
            )
        # Check against private IPv4 / IPv6 ranges
        if isinstance(ip_obj, ipaddress.IPv4Address):
            for net in RESTRICTED_IPV4_NETWORKS:
                if ip_obj in net:
                    return True, (
                        f"La dirección IP {ip_obj} pertenece a un rango privado o reservado ({net}). "
                        f"Los sondeos desde la Nube Sentinel solo pueden monitorear IPs públicas. "
                        f"Para monitorizar redes privadas LAN, asigna este objetivo a un 'Guardián Sentinine'."
                    )
        elif isinstance(ip_obj, ipaddress.IPv6Address):
            for net in RESTRICTED_IPV6_NETWORKS:
                if ip_obj in net:
                    return True, (
                        f"La dirección IPv6 {ip_obj} pertenece a un rango privado o reservado ({net}). "
                        f"Para monitorizar redes privadas, utiliza un 'Guardián Sentinine'."
                    )

    return False, ""


def _validate_and_resolve_endpoint(
    endpoint: str,
    allow_private: bool = False,
) -> tuple[str, ParseResult, tuple[str, ...]]:
    """
    Validate that an endpoint (URL, hostname, or IP:port) is safe against SSRF attacks.
    
    Args:
        endpoint: The target URL or hostname (e.g. 'https://api.example.com/v1', '192.168.1.1:8080')
        allow_private: If True (Sentinine runner), private RFC 1918 IPs are permitted,
                       but loopback and cloud metadata are strictly blocked.
                       If False (Cloud runner), private IPs and loopback are blocked.
    
    Returns:
        The validated endpoint string.
    
    Raises:
        ValidationError if the endpoint violates security constraints.
    """
    if not endpoint or not endpoint.strip():
        raise ValidationError("El endpoint no puede estar vacío.")

    raw = endpoint.strip()

    # Prepend scheme if missing (e.g. 'example.com:443') for urlparse
    if "://" not in raw:
        test_url = f"http://{raw}"
    else:
        test_url = raw

    try:
        parsed = urlparse(test_url)
    except Exception as exc:
        raise ValidationError(f"Formato de endpoint inválido: {str(exc)}")

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        raise ValidationError("No se pudo determinar el nombre de host o dirección IP del endpoint.")

    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Solo se permiten destinos HTTP o HTTPS.")
    if parsed.username or parsed.password:
        raise ValidationError("No se permiten credenciales embebidas en la URL.")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise ValidationError("El puerto del destino no es válido.") from exc
    if not 1 <= port <= 65535:
        raise ValidationError("El puerto del destino debe estar entre 1 y 65535.")

    # Check against known dangerous cloud metadata hostnames
    if hostname in CLOUD_METADATA_HOSTS:
        raise ValidationError(
            f"El destino '{hostname}' es una dirección protegida o metadata interna prohibida."
        )

    # Check if hostname is a direct IP address
    try:
        ip_obj = ipaddress.ip_address(hostname)
        is_restr, reason = is_ip_restricted(ip_obj, allow_private=allow_private)
        if is_restr:
            raise ValidationError(reason)
        return raw, parsed, (str(ip_obj),)
    except ValueError:
        # It's a domain name / hostname, proceed to DNS resolution check
        pass

    # Resolve hostname to verify underlying IP addresses (DNS Rebinding / SSRF protection)
    try:
        addr_info = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
        resolved_ips = tuple(sorted({item[4][0] for item in addr_info}))
        if not resolved_ips:
            raise ValidationError(f"El destino '{hostname}' no resolvió ninguna dirección IP.")

        for ip_str in resolved_ips:
            ip_obj = ipaddress.ip_address(ip_str)
            is_restr, reason = is_ip_restricted(ip_obj, allow_private=allow_private)
            if is_restr:
                raise ValidationError(
                    f"El dominio '{hostname}' resuelve a la IP restringida {ip_str}. {reason}"
                )
    except socket.gaierror as exc:
        raise ValidationError(
            f"No se pudo resolver de forma segura el destino '{hostname}'."
        ) from exc

    return raw, parsed, resolved_ips


def validate_safe_target_endpoint(endpoint: str, allow_private: bool = False) -> str:
    """Validate an endpoint and every IP returned by DNS."""
    raw, _, _ = _validate_and_resolve_endpoint(endpoint, allow_private=allow_private)
    return raw


def resolve_safe_target_endpoint(
    endpoint: str,
    allow_private: bool = False,
) -> tuple[str, str, int, tuple[str, ...]]:
    """Return a validated endpoint and the IP literals safe to connect to."""
    raw, parsed, resolved_ips = _validate_and_resolve_endpoint(
        endpoint,
        allow_private=allow_private,
    )
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return raw, parsed.hostname or "", port, resolved_ips


def validate_safe_public_url(url: str) -> str:
    """Validate that a URL is a public, safe URL (SSRF protection)."""
    try:
        return validate_safe_target_endpoint(url, allow_private=False)
    except ValidationError as exc:
        msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
        raise SSRFSecurityException(msg)


def resolve_safe_public_url(url: str) -> tuple[str, str, int, tuple[str, ...]]:
    """Resolve and validate a public URL for a DNS-pinned connection.

    The caller must connect to one of the returned IP literals instead of
    resolving the hostname a second time. This closes the DNS-rebinding gap
    between validation and connection establishment.
    """
    try:
        raw, hostname, port, resolved_ips = resolve_safe_target_endpoint(
            url,
            allow_private=False,
        )
    except ValidationError as exc:
        msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
        raise SSRFSecurityException(msg)

    return raw, hostname, port, resolved_ips
