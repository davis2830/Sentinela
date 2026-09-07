import logging
import re
import requests
from django.db import models, transaction
from django.utils import timezone

from .models import SecurityHeaderResult, SecurityHeaderTarget

logger = logging.getLogger(__name__)

# Security headers to check with their weights, official names and descriptions
SECURITY_HEADERS = {
    "content-security-policy": {
        "weight": 25,
        "name": "Content-Security-Policy",
        "description": "Previene ataques XSS, inyección de datos y clickjacking restringiendo los orígenes de contenido permitido.",
    },
    "strict-transport-security": {
        "weight": 20,
        "name": "Strict-Transport-Security (HSTS)",
        "description": "Fuerza conexiones HTTPS seguras y protege contra ataques de degradación SSL/TLS y secuestro de cookies.",
    },
    "x-frame-options": {
        "weight": 15,
        "name": "X-Frame-Options",
        "description": "Protege contra ataques de Clickjacking evitando que el sitio sea embebido en iframes no autorizados.",
    },
    "x-content-type-options": {
        "weight": 10,
        "name": "X-Content-Type-Options",
        "description": "Previene el MIME-sniffing obligando a los navegadores a adherirse estrictamente al Content-Type declarado.",
    },
    "referrer-policy": {
        "weight": 10,
        "name": "Referrer-Policy",
        "description": "Controla cuánta información de referencia (URL previa) se transmite en las peticiones salientes.",
    },
    "permissions-policy": {
        "weight": 10,
        "name": "Permissions-Policy",
        "description": "Restringe el acceso del navegador a características sensibles de hardware (cámara, micrófono, geolocalización).",
    },
    "cross-origin-opener-policy": {
        "weight": 5,
        "name": "Cross-Origin-Opener-Policy (COOP)",
        "description": "Aísla el contexto de navegación superior impidiendo accesos no autorizados entre documentos de distinto origen.",
    },
    "cross-origin-resource-policy": {
        "weight": 5,
        "name": "Cross-Origin-Resource-Policy (CORP)",
        "description": "Bloquea peticiones de lectura de recursos estáticos no autorizadas desde orígenes externos.",
    },
}

MAX_SCORE = sum(h["weight"] for h in SECURITY_HEADERS.values())


class SecurityHeadersService:
    """Service for security headers monitoring.

    Handles CRUD operations for targets, scanning, deep directive analysis,
    leak detection, and live testing.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_targets(organization_id):
        """Return all security header targets for an organization."""
        return SecurityHeaderTarget.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_target(target_id, organization_id):
        """Return a single target by ID within an organization."""
        return SecurityHeaderTarget.objects.get(
            id=target_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_target(organization_id, name, url, enabled=True):
        """Create a new security header target.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the target.
            url: URL to scan for security headers.
            enabled: Whether scans are active (default True).

        Returns:
            The created SecurityHeaderTarget instance.
        """
        target = SecurityHeaderTarget.objects.create(
            organization_id=organization_id,
            name=name,
            url=url,
            enabled=enabled,
        )
        try:
            from .tasks import scan_security_headers
            scan_security_headers.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    @transaction.atomic
    def update_target(target_id, organization_id, **fields):
        """Update an existing security header target."""
        target = SecurityHeaderTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                setattr(target, field, value)
        target.save()
        try:
            from .tasks import scan_security_headers
            scan_security_headers.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    @transaction.atomic
    def get_or_create_target(organization_id, name, url):
        """Get or auto-create security header target for monitoring targets."""
        if not url or url in ("http://localhost", "http://127.0.0.1"):
            return None
        full_url = url if url.startswith("http") else f"https://{url}"
        target, created = SecurityHeaderTarget.objects.get_or_create(
            organization_id=organization_id,
            url=full_url,
            defaults={"name": name},
        )
        if created:
            try:
                from .tasks import scan_security_headers
                scan_security_headers.delay(str(target.id))
            except Exception:
                pass
        return target

    @staticmethod
    def get_security_header_stats(organization_id):
        """Returns KPI summary statistics for security header targets."""
        targets = SecurityHeaderTarget.objects.filter(organization_id=organization_id)
        total = targets.count()

        # Grade A / A+: score >= 80
        grade_a = targets.filter(last_score__gte=80).count()
        # Grade B / C: 60 <= score < 80
        grade_bc = targets.filter(last_score__gte=60, last_score__lt=80).count()
        # Grade D / F / Error: score < 60 or null
        grade_df = targets.filter(models.Q(last_score__lt=60) | models.Q(last_score__isnull=True)).count()

        # Info leaks detected count
        info_leaks_count = targets.filter(info_leak_detected=True).count()

        scores = [t.last_score for t in targets if t.last_score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        return {
            "total": total,
            "grade_a": grade_a,
            "grade_bc": grade_bc,
            "grade_df": grade_df,
            "info_leaks_count": info_leaks_count,
            "avg_score": avg_score,
        }

    @staticmethod
    @transaction.atomic
    def delete_target(target_id, organization_id):
        """Delete a security header target."""
        target = SecurityHeaderTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        target.delete()

    @staticmethod
    def list_results(target_id, organization_id, limit=50):
        """Return recent scan results for a target."""
        target = SecurityHeaderTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        return target.results.all()[:limit]

    @staticmethod
    @transaction.atomic
    def record_result(
        target_id,
        score,
        grade,
        headers_found,
        headers_missing,
        raw_headers,
        response_time_ms=None,
        directives_analysis=None,
        info_leaks=None,
        error_message="",
    ):
        """Record a security headers scan result and update target state."""
        target = SecurityHeaderTarget.objects.get(id=target_id)
        now = timezone.now()

        directives_analysis = directives_analysis or {}
        info_leaks = info_leaks or {}

        result = SecurityHeaderResult.objects.create(
            target=target,
            score=score,
            grade=grade,
            response_time_ms=response_time_ms,
            headers_found=headers_found,
            headers_missing=headers_missing,
            directives_analysis=directives_analysis,
            info_leaks=info_leaks,
            raw_headers=raw_headers,
            error_message=error_message,
            checked_at=now,
        )

        has_hsts = "strict-transport-security" in headers_found
        has_csp = "content-security-policy" in headers_found
        has_xfo = "x-frame-options" in headers_found
        info_leak_detected = bool(info_leaks)

        server_header = str(raw_headers.get("server") or raw_headers.get("Server") or "")[:255]
        powered_by = str(raw_headers.get("x-powered-by") or raw_headers.get("X-Powered-By") or "")[:255]

        target.last_checked_at = now
        target.last_score = score
        target.last_grade = grade
        target.last_response_time_ms = response_time_ms
        target.has_hsts = has_hsts
        target.has_csp = has_csp
        target.has_xfo = has_xfo
        target.info_leak_detected = info_leak_detected
        target.server_header = server_header
        target.powered_by_header = powered_by
        target.save(
            update_fields=[
                "last_checked_at",
                "last_score",
                "last_grade",
                "last_response_time_ms",
                "has_hsts",
                "has_csp",
                "has_xfo",
                "info_leak_detected",
                "server_header",
                "powered_by_header",
            ]
        )

        return result

    @staticmethod
    def analyze_headers(response_headers):
        """Analyze HTTP response headers for security best practices and directives quality.

        Checks for presence of key security headers, evaluates directive strength,
        detects server technology leaks, calculates score and assigns letter grade.

        Args:
            response_headers: Dict of HTTP response headers.

        Returns:
            dict with score, grade, headers_found, headers_missing,
            directives_analysis, info_leaks.
        """
        lower_headers = {k.lower(): str(v).strip() for k, v in response_headers.items()}

        headers_found = {}
        headers_missing = []
        score = 0
        directives_analysis = {}

        # 1. Evaluate standard security headers and directives
        for header_name, info in SECURITY_HEADERS.items():
            if header_name in lower_headers:
                raw_val = lower_headers[header_name]
                headers_found[header_name] = raw_val
                weight = info["weight"]

                # Deep directive analysis
                header_score, analysis = SecurityHeadersService._analyze_directive(header_name, raw_val, weight)
                score += header_score
                directives_analysis[header_name] = analysis
            else:
                headers_missing.append(header_name)
                directives_analysis[header_name] = {
                    "present": False,
                    "status": "missing",
                    "value": None,
                    "notes": f"Cabecera ausente. {info['description']}",
                }

        # 2. Server Information Disclosure / Leaks detection
        info_leaks = SecurityHeadersService._detect_info_leaks(lower_headers)

        # Minor penalty if severe version leaks are present (up to 5 points)
        if info_leaks:
            score = max(0, score - (len(info_leaks) * 2))

        percentage = round((score / MAX_SCORE * 100), 1) if MAX_SCORE > 0 else 0.0
        grade = SecurityHeadersService._score_to_grade(percentage)

        return {
            "score": percentage,
            "grade": grade,
            "headers_found": headers_found,
            "headers_missing": headers_missing,
            "directives_analysis": directives_analysis,
            "info_leaks": info_leaks,
        }

    @staticmethod
    def _analyze_directive(header_name, value, weight):
        """Analyze quality of a specific security header value."""
        val_lower = value.lower()
        score = weight
        status = "optimal"
        notes = []

        if header_name == "strict-transport-security":
            max_age_match = re.search(r"max-age=(\d+)", val_lower)
            if max_age_match:
                max_age = int(max_age_match.group(1))
                if max_age == 0:
                    status = "danger"
                    score = 0
                    notes.append("HSTS está deshabilitado explícitamente (max-age=0).")
                elif max_age < 10886400:  # < 126 days
                    status = "warning"
                    score = int(weight * 0.6)
                    notes.append(f"max-age={max_age}s es inferior al mínimo recomendado de 1 año (31536000s).")
                else:
                    notes.append(f"max-age={max_age}s (óptimo >= 1 año).")
            else:
                status = "warning"
                score = int(weight * 0.5)
                notes.append("No se encontró la directiva max-age.")

            has_subdomains = "includesubdomains" in val_lower
            has_preload = "preload" in val_lower
            if has_subdomains:
                notes.append("includeSubDomains activo (protege subdominios).")
            else:
                notes.append("includeSubDomains ausente.")
            if has_preload:
                notes.append("preload activo (elegible para lista oficial en navegadores).")

            return score, {
                "present": True,
                "status": status,
                "value": value,
                "max_age": int(max_age_match.group(1)) if max_age_match else None,
                "include_subdomains": has_subdomains,
                "preload": has_preload,
                "notes": " ".join(notes),
            }

        elif header_name == "content-security-policy":
            has_unsafe_inline = "'unsafe-inline'" in val_lower
            has_unsafe_eval = "'unsafe-eval'" in val_lower
            has_wildcard = " * " in f" {val_lower} " or val_lower.startswith("* ") or val_lower.endswith(" *")

            if has_unsafe_inline or has_unsafe_eval:
                status = "warning"
                score = int(weight * 0.7)
                if has_unsafe_inline:
                    notes.append("Contiene 'unsafe-inline' (aumenta riesgo XSS).")
                if has_unsafe_eval:
                    notes.append("Contiene 'unsafe-eval' (permite ejecución dinámica).")
            elif has_wildcard:
                status = "warning"
                score = int(weight * 0.8)
                notes.append("Contiene comodín '*' que permite orígenes universales.")
            else:
                notes.append("CSP configurada con directivas seguras.")

            return score, {
                "present": True,
                "status": status,
                "value": value,
                "has_unsafe_inline": has_unsafe_inline,
                "has_unsafe_eval": has_unsafe_eval,
                "has_wildcard": has_wildcard,
                "notes": " ".join(notes),
            }

        elif header_name == "x-frame-options":
            if val_lower in ("deny", "sameorigin"):
                status = "optimal"
                notes.append(f"Anti-Clickjacking robusto ({value.upper()}).")
            else:
                status = "warning"
                score = int(weight * 0.5)
                notes.append(f"Valor '{value}' no es el estándar DENY o SAMEORIGIN.")

            return score, {
                "present": True,
                "status": status,
                "value": value,
                "notes": " ".join(notes),
            }

        elif header_name == "x-content-type-options":
            if val_lower == "nosniff":
                status = "optimal"
                notes.append("Protección anti-sniffing de tipos MIME activa (nosniff).")
            else:
                status = "warning"
                score = int(weight * 0.5)
                notes.append(f"Valor '{value}' esperado: 'nosniff'.")

            return score, {
                "present": True,
                "status": status,
                "value": value,
                "notes": " ".join(notes),
            }

        elif header_name == "referrer-policy":
            recommended = (
                "strict-origin-when-cross-origin",
                "no-referrer",
                "no-referrer-when-downgrade",
                "same-origin",
                "strict-origin",
            )
            if any(r in val_lower for r in recommended):
                status = "optimal"
                notes.append(f"Política de privacidad segura ({value}).")
            else:
                status = "warning"
                score = int(weight * 0.7)
                notes.append(f"Política permisiva '{value}'. Se sugiere 'strict-origin-when-cross-origin'.")

            return score, {
                "present": True,
                "status": status,
                "value": value,
                "notes": " ".join(notes),
            }

        elif header_name == "permissions-policy":
            status = "optimal"
            notes.append(f"Control granular de permisos del navegador activo ({len(value.split(','))} directivas).")
            return score, {
                "present": True,
                "status": status,
                "value": value,
                "notes": " ".join(notes),
            }

        # Default for other headers
        return score, {
            "present": True,
            "status": "optimal",
            "value": value,
            "notes": f"Cabecera activa: {value}",
        }

    @staticmethod
    def _detect_info_leaks(lower_headers):
        """Detect server leaks that expose software and versions."""
        leaks = {}

        # 1. Server header with version
        server_val = lower_headers.get("server")
        if server_val:
            # Check if version numbers or detailed vendor strings are included
            has_version = bool(re.search(r"\d+\.\d+", server_val))
            if has_version or any(v in server_val.lower() for v in ("apache", "nginx", "iis", "ubuntu", "debian", "centos", "gunicorn")):
                leaks["server"] = {
                    "header": "Server",
                    "value": server_val,
                    "severity": "medium" if has_version else "low",
                    "recommendation": "Ocultar la versión del servidor web (ej. 'server_tokens off;' en Nginx, 'ServerTokens Prod' en Apache).",
                }

        # 2. X-Powered-By
        powered_val = lower_headers.get("x-powered-by")
        if powered_val:
            leaks["x-powered-by"] = {
                "header": "X-Powered-By",
                "value": powered_val,
                "severity": "medium",
                "recommendation": "Remover la cabecera X-Powered-By para evitar exponer el runtime (PHP, Express, ASP.NET, etc.).",
            }

        # 3. ASP.NET version headers
        for asp_hdr in ("x-aspnet-version", "x-aspnetmvc-version"):
            val = lower_headers.get(asp_hdr)
            if val:
                leaks[asp_hdr] = {
                    "header": asp_hdr,
                    "value": val,
                    "severity": "medium",
                    "recommendation": f"Deshabilitar la cabecera '{asp_hdr}' en el archivo web.config (enableVersionHeader=false).",
                }

        # 4. Generator / Framework disclosure
        for gen_hdr in ("x-generator", "x-drupal-cache", "x-varnish"):
            val = lower_headers.get(gen_hdr)
            if val:
                leaks[gen_hdr] = {
                    "header": gen_hdr,
                    "value": val,
                    "severity": "low",
                    "recommendation": f"Suprimir la cabecera de divulgación de tecnología '{gen_hdr}'.",
                }

        return leaks

    @staticmethod
    def _score_to_grade(percentage):
        """Convert a percentage score to a letter grade."""
        if percentage >= 95:
            return "A+"
        elif percentage >= 80:
            return "A"
        elif percentage >= 70:
            return "B"
        elif percentage >= 60:
            return "C"
        elif percentage >= 50:
            return "D"
        else:
            return "F"

    @staticmethod
    def test_headers(url):
        """Perform a real-time on-demand security headers audit without saving to database.

        Args:
            url: URL string to scan.

        Returns:
            dict containing HTTP status, latency, score, grade, and headers audit.
        """
        raw_url = url.strip()
        if not raw_url.startswith("http://") and not raw_url.startswith("https://"):
            raw_url = f"https://{raw_url}"

        target_url = raw_url
        headers = {
            "User-Agent": "Sentinel-NOC-HeaderAudit/1.0",
        }

        # If testing internal backend in docker
        if "localhost:8000" in target_url or "127.0.0.1:8000" in target_url:
            target_url = target_url.replace("localhost:8000", "backend:8000").replace("127.0.0.1:8000", "backend:8000")
            headers["Host"] = "localhost"

        try:
            response = requests.get(
                target_url,
                headers=headers,
                timeout=12,
                allow_redirects=True,
                verify=False if "localhost" in target_url or "127.0.0.1" in target_url else True,
            )
            elapsed_ms = int(response.elapsed.total_seconds() * 1000)
            raw_headers = dict(response.headers)
            analysis = SecurityHeadersService.analyze_headers(raw_headers)

            return {
                "url": raw_url,
                "http_status": response.status_code,
                "response_time_ms": elapsed_ms,
                "score": analysis["score"],
                "grade": analysis["grade"],
                "headers_found": analysis["headers_found"],
                "headers_missing": analysis["headers_missing"],
                "directives_analysis": analysis["directives_analysis"],
                "info_leaks": analysis["info_leaks"],
                "raw_headers": raw_headers,
                "success": True,
                "error": None,
            }
        except requests.exceptions.Timeout:
            return {
                "url": raw_url,
                "http_status": 0,
                "response_time_ms": 0,
                "score": 0,
                "grade": "F",
                "headers_found": {},
                "headers_missing": list(SECURITY_HEADERS.keys()),
                "directives_analysis": {},
                "info_leaks": {},
                "raw_headers": {},
                "success": False,
                "error": "Tiempo de espera agotado (Timeout) al consultar el servidor.",
            }
        except requests.exceptions.SSLError as exc:
            return {
                "url": raw_url,
                "http_status": 0,
                "response_time_ms": 0,
                "score": 0,
                "grade": "F",
                "headers_found": {},
                "headers_missing": list(SECURITY_HEADERS.keys()),
                "directives_analysis": {},
                "info_leaks": {},
                "raw_headers": {},
                "success": False,
                "error": f"Fallo en la negociación SSL/TLS: {str(exc)}",
            }
        except Exception as exc:
            return {
                "url": raw_url,
                "http_status": 0,
                "response_time_ms": 0,
                "score": 0,
                "grade": "F",
                "headers_found": {},
                "headers_missing": list(SECURITY_HEADERS.keys()),
                "directives_analysis": {},
                "info_leaks": {},
                "raw_headers": {},
                "success": False,
                "error": f"Error de conexión: {str(exc)}",
            }

    @staticmethod
    def bulk_action(organization_id, action, target_ids):
        """Execute a bulk action on a list of security header targets.

        Supported actions: 'scan', 'pause', 'resume', 'delete'.
        """
        targets = SecurityHeaderTarget.objects.filter(
            id__in=target_ids,
            organization_id=organization_id,
        )
        count = targets.count()
        if count == 0:
            return {"count": 0, "message": "No se encontraron endpoints válidos."}

        if action == "scan":
            from .tasks import scan_security_headers
            for target in targets:
                scan_security_headers.delay(str(target.id))
            return {
                "count": count,
                "action": "scan",
                "message": f"Escaneo en lote iniciado para {count} endpoints.",
            }

        elif action == "pause":
            targets.update(enabled=False)
            return {
                "count": count,
                "action": "pause",
                "message": f"Monitoreo pausado para {count} endpoints.",
            }

        elif action == "resume":
            targets.update(enabled=True)
            return {
                "count": count,
                "action": "resume",
                "message": f"Monitoreo reanudado para {count} endpoints.",
            }

        elif action == "delete":
            with transaction.atomic():
                targets.delete()
            return {
                "count": count,
                "action": "delete",
                "message": f"{count} endpoints eliminados correctamente.",
            }

        else:
            raise ValueError(f"Acción desconocida: {action}")