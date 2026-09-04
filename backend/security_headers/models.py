from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class SecurityHeaderTarget(OrganizationOwnedModel):
    """Represents a URL to scan for security headers.

    Analyzes HTTP response headers for security best practices
    like CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
    """

    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500)
    enabled = models.BooleanField(default=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_score = models.IntegerField(null=True, blank=True)
    last_grade = models.CharField(max_length=5, blank=True, default="")
    last_response_time_ms = models.IntegerField(null=True, blank=True)
    has_hsts = models.BooleanField(default=False)
    has_csp = models.BooleanField(default=False)
    has_xfo = models.BooleanField(default=False)
    info_leak_detected = models.BooleanField(default=False)
    server_header = models.CharField(max_length=255, blank=True, default="")
    powered_by_header = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        db_table = "security_headers_target"

    def __str__(self):
        return f"{self.name} ({self.url})"


class SecurityHeaderResult(BaseModel):
    """Represents a security headers scan result.

    Stores the analysis of each security header, a score,
    and details about what is present or missing.
    """

    target = models.ForeignKey(
        SecurityHeaderTarget,
        on_delete=models.CASCADE,
        related_name="results",
    )
    score = models.IntegerField(default=0)
    grade = models.CharField(max_length=5, blank=True)
    response_time_ms = models.IntegerField(null=True, blank=True)
    headers_found = models.JSONField(default=dict, blank=True)
    headers_missing = models.JSONField(default=list, blank=True)
    directives_analysis = models.JSONField(default=dict, blank=True)
    info_leaks = models.JSONField(default=dict, blank=True)
    raw_headers = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    checked_at = models.DateTimeField()

    class Meta:
        ordering = ["-checked_at"]
        db_table = "security_headers_result"
        indexes = [
            models.Index(fields=["target", "-checked_at"]),
        ]

    def __str__(self):
        return f"{self.target.name} - Score: {self.score} @ {self.checked_at}"