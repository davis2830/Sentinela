import ipaddress

from django.conf import settings


def get_client_ip(request):
    """Return X-Forwarded-For only when the immediate peer is trusted."""
    remote_addr = request.META.get("REMOTE_ADDR", "")
    try:
        peer = ipaddress.ip_address(remote_addr)
    except ValueError:
        return remote_addr

    trusted = False
    for raw_cidr in getattr(settings, "TRUSTED_PROXY_CIDRS", []):
        try:
            if peer in ipaddress.ip_network(raw_cidr, strict=False):
                trusted = True
                break
        except ValueError:
            continue

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").strip()
    if trusted and forwarded and "," not in forwarded:
        try:
            ipaddress.ip_address(forwarded)
            return forwarded
        except ValueError:
            pass
    return remote_addr
