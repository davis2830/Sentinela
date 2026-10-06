"""Protocol-aware, opt-out coverage. WHOIS and duplicate API checks are explicit opt-ins."""
import ipaddress
from urllib.parse import urlsplit

DEFAULT_MODULES = {
    "https": {"ssl", "dns", "security"},
    "http": {"dns", "security"},
    "dns": {"dns"},
    "ssl": {"ssl"},
    "tcp": set(),
    "api": set(),
}


def coverage(target_type, endpoint, runner_type="cloud", requested=None):
    parsed = urlsplit(endpoint if "://" in endpoint else f"//{endpoint}")
    host = (parsed.hostname or "").strip("[]").lower()
    port = parsed.port or 443
    url = endpoint if "://" in endpoint else f"https://{endpoint}"
    if runner_type == "agent":
        return set(), host, port, url
    allowed = set(DEFAULT_MODULES.get(target_type, set()))
    if target_type in ("http", "https", "api"):
        allowed |= {"dns", "security", "domain"}
        if urlsplit(url).scheme == "https":
            allowed.add("ssl")
        if target_type == "api":
            allowed.add("api")
    modules = set(DEFAULT_MODULES.get(target_type, set())) if requested is None else set(requested)
    modules &= allowed
    try:
        ipaddress.ip_address(host)
        modules -= {"dns", "domain"}
    except ValueError:
        if "." not in host:
            modules -= {"dns", "domain"}
    return modules, host, port, url
