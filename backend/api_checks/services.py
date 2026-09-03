import json
import logging
import requests
from django.db import transaction
from django.utils import timezone

from .models import APICheckResult, APICheckTarget

logger = logging.getLogger(__name__)


def _infer_schema(data):
    """Infers simplified schema types from a JSON response."""
    if isinstance(data, dict):
        schema = {}
        for k, v in data.items():
            if isinstance(v, bool):
                schema[k] = "boolean"
            elif isinstance(v, int):
                schema[k] = "integer"
            elif isinstance(v, float):
                schema[k] = "float"
            elif isinstance(v, str):
                schema[k] = "string"
            elif isinstance(v, list):
                schema[k] = "list"
            elif isinstance(v, dict):
                schema[k] = "dict"
            else:
                schema[k] = "string"
        return schema
    elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        return _infer_schema(data[0])
    return {}


class APICheckService:
    """Service for API check management.

    Handles CRUD operations for API check targets, real-time live request testing,
    bulk operations and validation result recording.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_targets(organization_id):
        """Return all API check targets for an organization."""
        return APICheckTarget.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_target(target_id, organization_id):
        """Return a single API check target by ID within an organization."""
        return APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_target(
        organization_id,
        name,
        url,
        method="GET",
        expected_status=200,
        expected_response_time_ms=2000,
        expected_headers=None,
        expected_schema=None,
        request_headers=None,
        request_body=None,
        check_interval=60,
        enabled=True,
    ):
        """Create a new API check target."""
        target = APICheckTarget.objects.create(
            organization_id=organization_id,
            name=name,
            url=url,
            method=method.upper(),
            expected_status=expected_status,
            expected_response_time_ms=expected_response_time_ms,
            expected_headers=expected_headers or {},
            expected_schema=expected_schema or {},
            request_headers=request_headers or {},
            request_body=request_body or {},
            check_interval=check_interval or 60,
            enabled=enabled,
        )
        try:
            from .tasks import run_api_check
            run_api_check.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    @transaction.atomic
    def get_or_create_api_target(organization_id, name, url, method="GET"):
        """Get or auto-create API check target for monitoring targets."""
        if not url or url in ("http://localhost", "http://127.0.0.1"):
            return None
        target, created = APICheckTarget.objects.get_or_create(
            organization_id=organization_id,
            url=url,
            defaults={"name": name, "method": method.upper()},
        )
        if created:
            try:
                from .tasks import run_api_check
                run_api_check.delay(str(target.id))
            except Exception:
                pass
        return target

    @staticmethod
    @transaction.atomic
    def update_target(target_id, organization_id, **fields):
        """Update an existing API check target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                if field == "method":
                    value = str(value).upper()
                setattr(target, field, value)
        target.save()
        try:
            from .tasks import run_api_check
            run_api_check.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    def test_request(url, method="GET", headers=None, body=None):
        """Execute a live HTTP request to test an API endpoint in real time without saving."""
        clean_url = url.strip()
        method = method.strip().upper()
        req_headers = dict(headers or {})

        # Handle local docker alias
        if "localhost:8000" in clean_url or "127.0.0.1:8000" in clean_url:
            clean_url = clean_url.replace("localhost:8000", "backend:8000").replace("127.0.0.1:8000", "backend:8000")
            req_headers["Host"] = "localhost"

        # Handle basic auth auto-login for internal dev
        auth_key = None
        auth_header = ""
        for k, v in req_headers.items():
            if k.lower() == "authorization":
                auth_header = str(v)
                auth_key = k
                break

        if auth_header.startswith("Basic "):
            try:
                import base64
                raw_auth = base64.b64decode(auth_header.replace("Basic ", "")).decode("utf-8")
                if ":" in raw_auth:
                    u_email, u_pass = raw_auth.split(":", 1)
                    if ("backend:8000" in clean_url or "localhost:8000" in clean_url or "/api/v1/" in clean_url) and "@" in u_email:
                        from accounts.services import AuthService
                        auth_res = AuthService.login(u_email.strip(), u_pass.strip())
                        req_headers[auth_key or "Authorization"] = f"Bearer {auth_res['access_token']}"
            except Exception as auth_err:
                logger.warning("Auto-JWT login from Basic Auth failed in test_request: %s", auth_err)

        try:
            start = timezone.now()
            res = requests.request(
                method=method,
                url=clean_url,
                headers=req_headers,
                json=body if (body and method in ["POST", "PUT", "PATCH"]) else None,
                timeout=12,
            )
            elapsed_ms = round((timezone.now() - start).total_seconds() * 1000, 2)

            is_json = False
            parsed_body = None
            schema_inferred = {}

            try:
                parsed_body = res.json()
                is_json = True
                schema_inferred = _infer_schema(parsed_body)
            except Exception:
                is_json = False
                parsed_body = res.text[:2000]

            return {
                "success": True,
                "status_code": res.status_code,
                "response_time_ms": elapsed_ms,
                "headers": dict(res.headers),
                "body": parsed_body,
                "is_json": is_json,
                "size_bytes": len(res.content),
                "schema_inferred": schema_inferred,
                "error": None,
            }

        except Exception as exc:
            return {
                "success": False,
                "status_code": None,
                "response_time_ms": None,
                "headers": {},
                "body": None,
                "is_json": False,
                "size_bytes": 0,
                "schema_inferred": {},
                "error": str(exc),
            }

    @staticmethod
    def get_api_check_stats(organization_id):
        """Returns KPI summary statistics for API check targets."""
        targets = APICheckTarget.objects.filter(organization_id=organization_id)
        total = targets.count()
        pass_count = targets.filter(last_status="pass").count()
        slow_count = targets.filter(last_status="slow").count()
        fail_count = targets.filter(last_status__in=["fail", "error"]).count()
        paused_count = targets.filter(enabled=False).count()

        # Calculate average response time across recent results
        recent_results = APICheckResult.objects.filter(
            target__organization_id=organization_id,
            response_time_ms__isnull=False,
        ).order_by("-checked_at")[:100]

        avg_latency = 0
        if recent_results.exists():
            times = [r.response_time_ms for r in recent_results if r.response_time_ms]
            avg_latency = round(sum(times) / len(times), 1) if times else 0

        return {
            "total": total,
            "pass_count": pass_count,
            "slow_count": slow_count,
            "fail_count": fail_count,
            "paused_count": paused_count,
            "avg_latency": avg_latency,
        }

    @staticmethod
    @transaction.atomic
    def delete_target(target_id, organization_id):
        """Delete an API check target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        target.delete()

    @staticmethod
    def list_results(target_id, organization_id, limit=50):
        """Return recent check results for a target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        return target.results.all()[:limit]

    @staticmethod
    @transaction.atomic
    def record_result(
        target_id,
        status,
        http_status,
        response_time_ms,
        json_valid,
        schema_valid,
        headers_valid,
        response_headers,
        error_message="",
    ):
        """Record an API check result and update target state."""
        target = APICheckTarget.objects.get(id=target_id)
        now = timezone.now()

        result = APICheckResult.objects.create(
            target=target,
            status=status,
            http_status=http_status,
            response_time_ms=response_time_ms,
            json_valid=json_valid,
            schema_valid=schema_valid,
            headers_valid=headers_valid,
            response_headers=response_headers or {},
            error_message=error_message,
            checked_at=now,
        )

        target.last_checked_at = now
        target.last_status = status
        target.last_response_time_ms = response_time_ms
        target.last_http_status = http_status
        target.save(
            update_fields=[
                "last_checked_at",
                "last_status",
                "last_response_time_ms",
                "last_http_status",
            ]
        )

        return result

    @staticmethod
    def bulk_action(organization_id, action, target_ids):
        """Execute bulk actions (scan, pause, resume, delete) on selected targets."""
        targets = APICheckTarget.objects.filter(
            organization_id=organization_id, id__in=target_ids
        )
        count = targets.count()

        if action == "scan":
            from .tasks import run_api_check
            for t in targets:
                run_api_check.delay(str(t.id))
            return {"action": "scan", "processed": count, "message": f"{count} endpoints encolados para validación."}

        elif action == "pause":
            targets.update(enabled=False)
            return {"action": "pause", "processed": count, "message": f"{count} endpoints pausados."}

        elif action == "resume":
            targets.update(enabled=True)
            from .tasks import run_api_check
            for t in targets:
                run_api_check.delay(str(t.id))
            return {"action": "resume", "processed": count, "message": f"{count} endpoints reanudados."}

        elif action == "delete":
            deleted_count = targets.delete()[0]
            return {"action": "delete", "processed": deleted_count, "message": f"{deleted_count} endpoints eliminados."}

        else:
            raise ValueError(f"Acción no soportada: {action}")