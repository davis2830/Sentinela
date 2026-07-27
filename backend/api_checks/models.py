from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class APICheckTarget(OrganizationOwnedModel):
    """Represents an API endpoint to validate.

    Not limited to HTTP 200 — validates status, response time,
    JSON structure, schema, and headers.
    """

    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500)
    method = models.CharField(
        max_length=10,
        default="GET",
        choices=[("GET", "GET"), ("POST", "POST"), ("PUT", "PUT"), ("PATCH", "PATCH")],
    )
    expected_status = models.IntegerField(default=200)
    expected_response_time_ms = models.IntegerField(default=2000)
    expected_headers = models.JSONField(default=dict, blank=True)
    expected_schema = models.JSONField(default=dict, blank=True)
    request_headers = models.JSONField(default=dict, blank=True)
    request_body = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "api_checks_target"

    def __str__(self):
        return f"{self.name} ({self.method} {self.url})"


class APICheckResult(BaseModel):
    """Represents a single API check execution result.

    Stores validation results for status, response time,
    JSON validity, schema, and headers.
    """

    class ResultStatus(models.TextChoices):
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"
        SLOW = "slow", "Slow"
        ERROR = "error", "Error"

    target = models.ForeignKey(
        APICheckTarget,
        on_delete=models.CASCADE,
        related_name="results",
    )
    status = models.CharField(
        max_length=20,
        choices=ResultStatus.choices,
    )
    http_status = models.IntegerField(null=True, blank=True)
    response_time_ms = models.FloatField(null=True, blank=True)
    json_valid = models.BooleanField(null=True, blank=True)
    schema_valid = models.BooleanField(null=True, blank=True)
    headers_valid = models.BooleanField(null=True, blank=True)
    response_headers = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    checked_at = models.DateTimeField()

    class Meta:
        ordering = ["-checked_at"]
        db_table = "api_checks_result"
        indexes = [
            models.Index(fields=["target", "-checked_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.target.name} - {self.status} @ {self.checked_at}"