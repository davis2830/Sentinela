from django.db import transaction
from django.utils import timezone

from .models import SecurityHeaderResult, SecurityHeaderTarget


# Security headers to check with their weights and descriptions
SECURITY_HEADERS = {
    "content-security-policy": {
        "weight": 25,
        "description": "Prevents XSS, clickjacking, and other code injection attacks.",
    },
    "strict-transport-security": {
        "weight": 20,
        "description": "Enforces HTTPS connections (HSTS).",
    },
    "x-frame-options": {
        "weight": 15,
        "description": "Prevents clickjacking by controlling frame embedding.",
    },
    "x-content-type-options": {
        "weight": 10,
        "description": "Prevents MIME-type sniffing.",
    },
    "x-xss-protection": {
        "weight": 10,
        "description": "Enables browser XSS filtering (legacy but recommended).",
    },
    "referrer-policy": {
        "weight": 10,
        "description": "Controls how much referrer info is shared.",
    },
    "permissions-policy": {
        "weight": 5,
        "description": "Controls which browser features can be used.",
    },
    "cross-origin-opener-policy": {
        "weight": 5,
        "description": "Isolates browsing context from cross-origin documents.",
    },
}

MAX_SCORE = sum(h["weight"] for h in SECURITY_HEADERS.values())


class SecurityHeadersService:
    """Service for security headers monitoring.

    Handles CRUD operations for targets, scanning, and
    security header analysis with scoring.
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
        return SecurityHeaderTarget.objects.create(
            organization_id=organization_id,
            name=name,
            url=url,
            enabled=enabled,
        )

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
        error_message="",
    ):
        """Record a security headers scan result and update target state.

        Called by the scan_security_headers Celery task.

        Args:
            target_id: UUID of the target.
            score: Security score (0-100).
            grade: Letter grade (A+, A, B, C, D, F).
            headers_found: Dict of found headers with values.
            headers_missing: List of missing header names.
            raw_headers: Dict of all response headers.
            error_message: Error message if scan failed.

        Returns:
            The created SecurityHeaderResult instance.
        """
        target = SecurityHeaderTarget.objects.get(id=target_id)
        now = timezone.now()

        result = SecurityHeaderResult.objects.create(
            target=target,
            score=score,
            grade=grade,
            headers_found=headers_found,
            headers_missing=headers_missing,
            raw_headers=raw_headers,
            error_message=error_message,
            checked_at=now,
        )

        target.last_checked_at = now
        target.last_score = score
        target.save(update_fields=["last_checked_at", "last_score"])

        return result

    @staticmethod
    def analyze_headers(response_headers):
        """Analyze HTTP response headers for security best practices.

        Checks for presence of key security headers, calculates
        a score, and assigns a letter grade.

        Args:
            response_headers: Dict of HTTP response headers.

        Returns:
            dict with score, grade, headers_found, headers_missing.
        """
        lower_headers = {k.lower(): v for k, v in response_headers.items()}

        headers_found = {}
        headers_missing = []
        score = 0

        for header_name, info in SECURITY_HEADERS.items():
            if header_name in lower_headers:
                headers_found[header_name] = lower_headers[header_name]
                score += info["weight"]
            else:
                headers_missing.append(header_name)

        percentage = (score / MAX_SCORE * 100) if MAX_SCORE > 0 else 0
        grade = SecurityHeadersService._score_to_grade(percentage)

        return {
            "score": round(percentage, 1),
            "grade": grade,
            "headers_found": headers_found,
            "headers_missing": headers_missing,
        }

    @staticmethod
    def _score_to_grade(percentage):
        """Convert a percentage score to a letter grade.

        Args:
            percentage: Score from 0 to 100.

        Returns:
            Letter grade string (A+, A, B, C, D, F).
        """
        if percentage >= 95:
            return "A+"
        elif percentage >= 85:
            return "A"
        elif percentage >= 70:
            return "B"
        elif percentage >= 55:
            return "C"
        elif percentage >= 40:
            return "D"
        else:
            return "F"