"""Control-plane configuration, secrets and TLS policy for Senti9."""
import os
from pathlib import Path
import ssl
import stat
from urllib.parse import urlsplit

from common.safe_http import open_request


def development():
    mode = os.environ.get('SENTININE_ENV', 'production')
    if mode not in ('production', 'development'):
        raise ValueError('SENTININE_ENV debe ser production o development.')
    return mode == 'development'


def enabled(name):
    value = os.environ.get(name, 'false').lower()
    if value not in ('true','false','1','0'):
        raise ValueError(f'{name} debe ser true o false.')
    return value in ('true','1')


def validate_server_url(url):
    dev = development()
    parsed = urlsplit(url)
    if (not parsed.hostname or parsed.username is not None or parsed.password is not None
        or parsed.query or parsed.fragment or parsed.scheme not in ('https','http')):
        raise ValueError('El servidor debe ser una URL HTTPS sin credenciales, query ni fragmento.')
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError('Puerto de servidor no válido.')
    if parsed.scheme != 'https' and not (dev and enabled('SENTININE_ALLOW_HTTP')):
        raise ValueError('HTTPS requerido. HTTP solo con SENTININE_ENV=development y SENTININE_ALLOW_HTTP=true.')
    return url.rstrip('/')


def load_token():
    path = os.environ.get('SENTININE_TOKEN_FILE')
    if path:
        try:
            source = Path(path)
            info = source.stat()
            if not stat.S_ISREG(info.st_mode) or info.st_size > 4096:
                raise ValueError()
            readonly = os.name != 'nt' and bool(os.statvfs(source).f_flag & os.ST_RDONLY)
            if os.name != 'nt' and info.st_mode & 0o022 and not readonly:
                raise ValueError()
            with source.open('r', encoding='utf-8-sig') as stream:
                token = stream.read(4097).strip()
        except (OSError, ValueError, UnicodeError):
            raise ValueError('Archivo de token no válido o sin permisos seguros de lectura.') from None
    else:
        token = os.environ.get('SENTININE_TOKEN', os.environ.get('SENTINEL_TOKEN','')).strip()
    if not token or len(token) > 4096 or any(c.isspace() for c in token):
        raise ValueError('Se requiere token válido por archivo o variable de entorno.')
    return token


def tls_context(*, control=False, insecure=False):
    # Target exceptions never disable certificate validation on the control channel.
    if insecure and not development():
        raise ValueError('Omitir validación TLS solo está permitido en desarrollo explícito.')
    context = ssl.create_default_context()
    ca_file = os.environ.get('SENTININE_CONTROL_CA_FILE' if control else 'SENTININE_TARGET_CA_FILE')
    if ca_file:
        context.load_verify_locations(cafile=ca_file)
    if insecure and not control:
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    return context


def control_request(request, *, timeout=10):
    validate_server_url(request.full_url)
    return open_request(request, timeout=timeout, context=tls_context(control=True))
