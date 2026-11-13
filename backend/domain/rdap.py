"""RDAP via IANA bootstrap. Bounded public HTTPS, no redirects or provider links followed."""

import json
from datetime import datetime, timezone
from urllib.parse import quote, urlsplit
from django.core.cache import cache
from common import safe_http


def read_json(url):
    response = safe_http.get(
        url, timeout=(3, 8), stream=True, headers={"Accept": "application/rdap+json, application/json"}
    )
    try:
        if response.status_code != 200:
            raise ValueError("RDAP no disponible.")
        chunks = []
        size = 0
        for chunk in response.iter_content(16384):
            size += len(chunk)
            if size > 2 * 1024 * 1024:
                raise ValueError("Respuesta RDAP demasiado grande.")
            chunks.append(chunk)
        value = json.loads(b"".join(chunks))
        if not isinstance(value, dict):
            raise ValueError("Respuesta RDAP no válida.")
        return value
    finally:
        response.close()


def query(domain):
    bootstrap = cache.get("rdap-iana-bootstrap-v1")
    if bootstrap is None:
        bootstrap = read_json("https://data.iana.org/rdap/dns.json")
        cache.set("rdap-iana-bootstrap-v1", bootstrap, 86400)
    tld = domain.rsplit(".", 1)[-1].encode("idna").decode("ascii")
    endpoint = None
    for suffixes, urls in bootstrap.get("services", []):
        if tld in suffixes:
            endpoint = next((url for url in urls if urlsplit(url).scheme == "https"), None)
            break
    if not endpoint:
        raise ValueError("Sin proveedor RDAP HTTPS para este TLD.")
    url = endpoint.rstrip("/") + "/domain/" + quote(domain.encode("idna").decode("ascii"), safe=".")
    data = read_json(url)
    if data.get("objectClassName") != "domain":
        raise ValueError("Objeto RDAP no válido.")
    dates = {}
    for event in data.get("events", []):
        try:
            dates[event["eventAction"]] = datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        except (KeyError, ValueError, TypeError):
            continue
    statuses = data.get("status") or []
    registrar = ""
    for entity in data.get("entities", []):
        if "registrar" in entity.get("roles", []):
            card = entity.get("vcardArray", [])
            for field in card[1] if len(card) > 1 and isinstance(card[1], list) else []:
                if isinstance(field, list) and len(field) >= 4 and field[0] == "fn":
                    registrar = str(field[3])[:500]
    expiration = dates.get("expiration")
    return {
        "success": True,
        "domain": domain,
        "registrar": registrar,
        "creation_date": dates.get("registration"),
        "expiration_date": expiration,
        "last_updated": dates.get("last changed"),
        "days_until_expiration": (expiration - datetime.now(timezone.utc)).days if expiration else None,
        "is_locked": any("transfer prohibited" in str(s).lower() for s in statuses) if statuses else None,
        "status": statuses,
        "name_servers": [
            n["ldhName"].lower()
            for n in data.get("nameservers", [])
            if isinstance(n, dict) and isinstance(n.get("ldhName"), str)
        ],
        "registrant_country": "",
        "whois_server": "",
        "dnssec": "signed"
        if data.get("secureDNS", {}).get("delegationSigned") is True
        else "unsigned"
        if data.get("secureDNS", {}).get("delegationSigned") is False
        else "",
        "error_message": "",
        "data_source": "rdap",
        "source_url": url,
    }
