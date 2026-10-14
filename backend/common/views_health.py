"""Bounded readiness: every required dependency must be available."""
import time
from concurrent.futures import ThreadPoolExecutor, wait
from threading import Lock
from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix='readiness')
_probe_lock = Lock()
_flight = None
_workers_lock = Lock()
_worker_result = (0, False)


def database_ready():
    db = connections['default']
    try:
        if db.vendor == 'postgresql':
            db.settings_dict = {**db.settings_dict, 'OPTIONS': {
                **db.settings_dict.get('OPTIONS', {}),
                'connect_timeout': 1, 'options': '-c statement_timeout=1000',
            }}
        with db.cursor() as cursor:
            cursor.execute('SELECT 1')
            return cursor.fetchone()[0] == 1
    finally:
        db.close()


def cache_ready():
    key = '_sentinel_readiness'
    cache.set(key, 'ready', timeout=10)
    return cache.get(key) == 'ready'


def broker_ready():
    from config.celery import app
    with app.connection_for_read(connect_timeout=1) as broker:
        broker.ensure_connection(max_retries=0, timeout=1)
    return True


def workers_ready():
    global _worker_result
    from config.celery import app
    with _workers_lock:
        until, result = _worker_result
        if time.monotonic() < until:
            return result
        result = bool(app.control.inspect(timeout=1).ping())
        _worker_result = (time.monotonic() + 5, result)
        return result


def probe(function):
    started = time.perf_counter()
    try:
        healthy = function()
    except Exception:
        healthy = False
    return {'status': 'healthy' if healthy else 'unhealthy',
            'latency_ms': round((time.perf_counter() - started) * 1000, 2)}


class HealthCheckView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    # Cache failure must reach readiness, not fail earlier in cache-backed throttling.
    throttle_classes = ()

    def get(self, request):
        checks = {'database': database_ready, 'redis_cache': cache_ready,
                  'celery_broker': broker_ready, 'celery_workers': workers_ready}
        components = {name: {'status': 'unhealthy'} for name in checks}
        global _flight
        # Concurrent requests share one in-flight probe instead of false 503s
        # or an unbounded queue when a dependency hangs.
        with _probe_lock:
            if _flight is None or all(future.done() for future in _flight.values()):
                _flight = {name: _pool.submit(probe, fn) for name, fn in checks.items()}
            futures = dict(_flight)
        done, _ = wait(futures.values(), timeout=3.5)
        for name, future in futures.items():
            if future in done:
                components[name] = future.result()
        components['database']['engine'] = 'PostgreSQL 16'
        healthy = all(item['status'] == 'healthy' for item in components.values())
        return Response({'status': 'healthy' if healthy else 'degraded',
                         'service': 'Sentinel NOC Platform', 'version': '1.0.0',
                         'timestamp': timezone.now().isoformat(),
                         'environment': 'development' if settings.DEBUG else 'production',
                         'components': components}, status=200 if healthy else 503)
