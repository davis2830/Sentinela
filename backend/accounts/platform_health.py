"""Read-only diagnostics; no task arguments, remote execution or infrastructure secrets."""

from threading import Lock
from concurrent.futures import ThreadPoolExecutor, wait
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from .platform_auth import PlatformAPIView
from common.responses import success_response
from common.views_health import database_ready, cache_ready, broker_ready, workers_ready, probe

QUEUES = ("high_priority", "monitoring", "background", "celery")
_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="platform-health")
_probe_lock = Lock()
_inflight = None


def queue_sizes():
    from config.celery import app
    from kombu.transport.redis import Channel

    if not str(app.conf.broker_url).startswith(("redis://", "rediss://")):
        return [{"name": name, "ready": None, "status": "unavailable"} for name in QUEUES]
    import redis

    options = app.conf.broker_transport_options or {}
    client = redis.Redis.from_url(
        app.conf.broker_url, socket_timeout=1, socket_connect_timeout=1, decode_responses=False
    )
    try:
        steps = options.get("priority_steps", Channel.priority_steps)
        separator = options.get("sep", Channel.sep)
        prefix = options.get("global_keyprefix", "")
        pipe = client.pipeline(transaction=False)
        for name in QUEUES:
            for priority in steps:
                key = name if priority == 0 else name + separator + str(priority)
                pipe.llen(prefix + key)
        values = pipe.execute()
        return [
            {"name": name, "ready": sum(values[i * len(steps) : (i + 1) * len(steps)]), "status": "available"}
            for i, name in enumerate(QUEUES)
        ]
    finally:
        client.close()


def diagnostics():
    checks = {
        "database": database_ready,
        "redis_cache": cache_ready,
        "celery_broker": broker_ready,
        "celery_workers": workers_ready,
    }
    global _inflight
    with _probe_lock:
        if _inflight is None or all(future.done() for future in _inflight.values()):
            _inflight = {name: _pool.submit(probe, fn) for name, fn in checks.items()}
            _inflight["queues"] = _pool.submit(queue_sizes)
        futures = {name: _inflight[name] for name in checks}
        queues = _inflight["queues"]
    done, _ = wait([*futures.values(), queues], timeout=3.5)
    components = {
        name: future.result() if future in done else {"status": "unavailable", "latency_ms": None}
        for name, future in futures.items()
    }
    sizes = [{"name": name, "ready": None, "status": "unavailable"} for name in QUEUES]
    if queues in done:
        try:
            sizes = queues.result()
        except Exception:
            # Infrastructure boundary: report unavailability without exposing connection strings.
            import logging

            logging.getLogger(__name__).warning("Platform queue diagnostics unavailable", exc_info=True)
    healthy = all(item["status"] == "healthy" for item in components.values()) and all(
        row["status"] == "available" for row in sizes
    )
    return {
        "status": "healthy" if healthy else "degraded",
        "queried_at": timezone.now(),
        "environment": "development" if settings.DEBUG else "production",
        "components": components,
        "queues": sizes,
        "scope": "Mensajes listos en las colas configuradas, incluidas sus prioridades. No incluye tareas en ejecución.",
    }


class ComponentOutput(serializers.Serializer):
    status = serializers.CharField()
    latency_ms = serializers.FloatField(allow_null=True, required=False)


class QueueOutput(serializers.Serializer):
    name = serializers.CharField()
    ready = serializers.IntegerField(allow_null=True)
    status = serializers.CharField()


class HealthOutput(serializers.Serializer):
    status = serializers.CharField()
    queried_at = serializers.DateTimeField()
    environment = serializers.CharField()
    components = serializers.DictField(child=ComponentOutput())
    queues = QueueOutput(many=True)
    scope = serializers.CharField()


class PlatformHealthView(PlatformAPIView):
    output_serializer = HealthOutput

    def get(self, request):
        # One bounded snapshot at a time across application processes; no background polling.
        from django.core.cache import cache
        import logging

        try:
            saved = cache.get("platform:health:snapshot")
        except Exception:
            logging.getLogger(__name__).warning("Platform diagnostic cache unavailable", exc_info=True)
            saved = None
        if saved:
            return success_response(saved)
        result = diagnostics()
        try:
            cache.set("platform:health:snapshot", result, 5)
        except Exception:
            logging.getLogger(__name__).warning("Platform diagnostic snapshot could not be cached", exc_info=True)
        return success_response(result)
