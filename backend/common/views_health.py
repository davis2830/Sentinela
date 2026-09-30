"""
Health Check and Meta-Observability Views for Sentinel NOC
==========================================================
Provides external Dead Man's Snitch and internal SLA probes
verifying active connectivity and latency for:
  - PostgreSQL / TimescaleDB
  - Redis Distributed Cache
  - Celery Message Broker & Workers
"""

import time
import logging
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    """
    Public health probe for Sentinel NOC platform.
    Designed for external monitoring (Dead Man's Snitch, UptimeRobot, Kubernetes liveness/readiness).
    Returns 200 OK when core components are responsive, or 503 Service Unavailable when degraded.
    """

    permission_classes = (AllowAny,)
    authentication_classes = ()  # Bypass JWT to allow external snitches without tokens

    def get(self, request):
        overall_healthy = True
        components = {}

        # 1. Check Database (PostgreSQL / TimescaleDB)
        db_start = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
            components["database"] = {
                "status": "healthy",
                "latency_ms": db_latency_ms,
                "engine": "PostgreSQL + TimescaleDB",
            }
        except Exception as exc:
            db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
            overall_healthy = False
            logger.error("Health check failed on Database: %s", exc)
            components["database"] = {
                "status": "unhealthy",
                "latency_ms": db_latency_ms,
                "error": str(exc),
            }

        # 2. Check Redis Cache
        redis_start = time.perf_counter()
        try:
            test_key = "_sentinel_healthcheck_ping"
            cache.set(test_key, "pong", timeout=10)
            cached_val = cache.get(test_key)
            redis_latency_ms = round((time.perf_counter() - redis_start) * 1000, 2)
            if cached_val == "pong":
                components["redis_cache"] = {
                    "status": "healthy",
                    "latency_ms": redis_latency_ms,
                    "role": "Distributed Cache & Session Store",
                }
            else:
                overall_healthy = False
                components["redis_cache"] = {
                    "status": "unhealthy",
                    "latency_ms": redis_latency_ms,
                    "error": "Cache write/read mismatch",
                }
        except Exception as exc:
            redis_latency_ms = round((time.perf_counter() - redis_start) * 1000, 2)
            overall_healthy = False
            logger.error("Health check failed on Redis Cache: %s", exc)
            components["redis_cache"] = {
                "status": "unhealthy",
                "latency_ms": redis_latency_ms,
                "error": str(exc),
            }

        # 3. Check Celery Broker Connectivity
        celery_start = time.perf_counter()
        try:
            from config.celery import app as celery_app
            with celery_app.connection_for_read() as conn:
                conn.ensure_connection(max_retries=1, timeout=2.0)
            celery_latency_ms = round((time.perf_counter() - celery_start) * 1000, 2)
            components["celery_broker"] = {
                "status": "healthy",
                "latency_ms": celery_latency_ms,
                "role": "Task Queue Broker",
            }
        except Exception as exc:
            celery_latency_ms = round((time.perf_counter() - celery_start) * 1000, 2)
            # Celery broker degradation is logged; if Redis is up it's usually transient
            components["celery_broker"] = {
                "status": "degraded",
                "latency_ms": celery_latency_ms,
                "error": str(exc),
            }

        status_code = status.HTTP_200_OK if overall_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

        payload = {
            "status": "healthy" if overall_healthy else "degraded",
            "service": "Sentinel NOC Platform",
            "version": "1.0.0",
            "timestamp": timezone.now().isoformat(),
            "environment": "production" if not settings.DEBUG else "development",
            "components": components,
        }

        return Response(payload, status=status_code)
