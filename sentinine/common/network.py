"""IPv4/IPv6 parsing and bounded system resolution without abandoned DNS threads."""
import ipaddress
import json
import math
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit, unquote

RESOLVER_WORKER = Path(__file__).with_name('resolver_worker.py')


def parse_endpoint(endpoint, default_port=80, allow_path=False):
    if not isinstance(endpoint, str):
        raise ValueError('Destino no válido.')
    raw = endpoint.strip()
    if not raw or any(c.isspace() for c in raw):
        raise ValueError('Destino vacío o con espacios.')
    if '://' not in raw and not raw.startswith('['):
        try:
            ipaddress.IPv6Address(raw)
            return raw, default_port, False
        except ValueError:
            pass
    parsed = urlsplit(raw if '://' in raw else '//'+raw)
    if (parsed.scheme not in ('','http','https') or not parsed.hostname or
        parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment or
        (not allow_path and parsed.path not in ('','/'))):
        raise ValueError('Usa hostname, IPv4 o [IPv6]:puerto sin credenciales.')
    host = unquote(parsed.hostname)
    port = parsed.port
    if port is None:
        if parsed.netloc.endswith(':'):
            raise ValueError('Puerto vacío.')
        port = 443 if parsed.scheme == 'https' else default_port
    if not 1 <= port <= 65535:
        raise ValueError('Puerto fuera de rango.')
    return host, port, parsed.port is not None


def dns_host(endpoint):
    host, _, explicit = parse_endpoint(endpoint, allow_path=True)
    if explicit:
        raise ValueError('DNS resuelve nombres; un puerto no selecciona el servidor DNS.')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return host
    raise ValueError('DNS requiere un nombre; una IP literal no comprueba resolución.')


def budget(value):
    if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or value <= 0:
        raise ValueError('Timeout no válido.')
    return float(value)


def resolution_timeout():
    value = float(os.environ.get('SENTININE_DNS_TIMEOUT_SECONDS','5'))
    if not math.isfinite(value) or not .05 <= value <= 120:
        raise ValueError('SENTININE_DNS_TIMEOUT_SECONDS debe estar entre 0.05 y 120.')
    return value


def resolve_addresses(host, port, timeout):
    timeout = budget(timeout)
    if ':' in host:
        host = unquote(host)
    try:
        ipaddress.ip_address(host)
    except ValueError:
        labels = host.rstrip('.').encode('idna').split(b'.')
        if len(b'.'.join(labels)) > 253 or not all(0 < len(label) <= 63 for label in labels) or any(c.isspace() for c in host):
            raise ValueError('Hostname no válido.')
    else:
        # AI_NUMERICHOST never calls DNS, including numeric IPv6 scope identifiers.
        return [(family, kind, proto, tuple(address)) for family, kind, proto, _, address in
                socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM,
                                   socket.IPPROTO_TCP, socket.AI_NUMERICHOST | socket.AI_NUMERICSERV)]
    try:
        # No inherited token, token-file path, PYTHONPATH or application secrets.
        environment = {key:value for key,value in os.environ.items()
                       if key.upper() in ('SYSTEMROOT','WINDIR','PATH','LANG','LC_ALL')}
        completed = subprocess.run([sys.executable, '-I', str(RESOLVER_WORKER)],
            input=json.dumps({'host': host, 'port': port}), text=True, capture_output=True,
            timeout=timeout, check=True, env=environment)
    except subprocess.TimeoutExpired:
        # subprocess.run kills and reaps the child; no stuck resolver threads remain.
        raise TimeoutError('Tiempo de resolución DNS agotado.') from None
    except (subprocess.SubprocessError, OSError):
        raise OSError('No se pudo ejecutar el resolver aislado.') from None
    result = json.loads(completed.stdout)
    if result.get('error') or not result.get('addresses'):
        raise socket.gaierror('Nombre no resuelto.')
    return [(family, kind, proto, tuple(address)) for family, kind, proto, address in result['addresses']]


def validate_target_addresses(addresses):
    for _, _, _, address in addresses:
        ip = ipaddress.ip_address(address[0].split('%')[0])
        mapped = getattr(ip, 'ipv4_mapped', None)
        ip = mapped or ip
        if ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast or str(ip)=='fd00:ec2::254':
            raise OSError('Destino protegido: loopback, link-local, metadata o multicast.')


def connect_bounded(host, port, timeout, target=False):
    deadline = time.monotonic()+budget(timeout)
    addresses = resolve_addresses(host, port, min(timeout, resolution_timeout()))
    if target:
        validate_target_addresses(addresses)
    last_error = None
    for index, (family, kind, proto, address) in enumerate(addresses):
        remaining = deadline-time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Tiempo de conexión agotado.')
        sock = socket.socket(family, kind, proto)
        try:
            # Split the remaining budget so an unreachable family allows fallback.
            sock.settimeout(remaining/(len(addresses)-index))
            sock.connect(address)
            remaining = deadline-time.monotonic()
            if remaining <= 0:
                raise TimeoutError('Tiempo de conexión agotado.')
            sock.settimeout(remaining)
            return sock
        except OSError as exc:
            sock.close()
            last_error = exc
        except BaseException:
            sock.close()
            raise
    raise last_error or socket.gaierror('Sin direcciones de conexión.')
