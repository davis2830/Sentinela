from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class MonitoringTarget(OrganizationOwnedModel):
    """Represents a resource being monitored.

    Can be a domain, IP, API endpoint, service, or port.
    Each target has a type, endpoint, check interval, and enabled flag.
    """

    class TargetType(models.TextChoices):
        HTTP = "http", "HTTP"
        HTTPS = "https", "HTTPS"
        TCP = "tcp", "TCP"
        DNS = "dns", "DNS"
        API = "api", "API"
        SSL = "ssl", "SSL"

    name = models.CharField(max_length=255)
    target_type = models.CharField(
        max_length=20,
        choices=TargetType.choices,
        default=TargetType.HTTP,
    )
    endpoint = models.CharField(max_length=500)
    interval = models.PositiveIntegerField(
        default=60,
        help_text="Check interval in seconds.",
    )
    enabled = models.BooleanField(default=True)
    http_method = models.CharField(max_length=10, default="GET")
    expected_status = models.PositiveIntegerField(default=200)
    custom_headers = models.JSONField(default=dict, blank=True)
    request_body = models.TextField(blank=True, default="")
    max_latency_ms = models.PositiveIntegerField(default=2000)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=20, null=True, blank=True)
    last_latency = models.FloatField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "monitoring_target"

    def __str__(self):
        return f"{self.name} ({self.target_type})"


class MonitoringCheck(BaseModel):
    """Represents a single execution of a monitoring check.

    Stores the result, latency, and details of each check.
    Retention policies should be applied to avoid unbounded growth.
    """

    class CheckStatus(models.TextChoices):
        UP = "up", "Up"
        DOWN = "down", "Down"
        SLOW = "slow", "Slow"
        ERROR = "error", "Error"

    target = models.ForeignKey(
        MonitoringTarget,
        on_delete=models.CASCADE,
        related_name="checks",
    )
    status = models.CharField(
        max_length=20,
        choices=CheckStatus.choices,
    )
    latency = models.FloatField(null=True, blank=True)
    checked_at = models.DateTimeField()
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-checked_at"]
        db_table = "monitoring_check"
        indexes = [
            models.Index(fields=["target", "-checked_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.target.name} - {self.status} @ {self.checked_at}"


class MaintenanceWindow(BaseModel):
    """Represents a scheduled period where alerts are suppressed for a target."""

    target = models.ForeignKey(
        MonitoringTarget,
        on_delete=models.CASCADE,
        related_name="maintenance_windows",
    )
    name = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_time"]
        db_table = "monitoring_maintenance_window"

    def __str__(self):
        return f"Mantenimiento {self.name} para {self.target.name} ({self.start_time} - {self.end_time})"