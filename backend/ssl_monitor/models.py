from django.db import models

from common.models import OrganizationOwnedModel


class SSLCertificate(OrganizationOwnedModel):
    """Stores SSL certificate information for a monitored domain.

    Updated by the scan_ssl_certificate Celery task.
    Used for expiration alerts and certificate chain analysis.
    """

    domain = models.CharField(max_length=500)
    issuer = models.CharField(max_length=500, blank=True)
    subject = models.CharField(max_length=500, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    algorithm = models.CharField(max_length=100, blank=True)
    fingerprint = models.CharField(max_length=500, blank=True)
    days_remaining = models.IntegerField(null=True, blank=True)
    is_valid = models.BooleanField(default=True)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    san_domains = models.JSONField(default=list, blank=True)
    tls_version = models.CharField(max_length=50, blank=True)
    port = models.IntegerField(default=443)
    issued_at = models.DateTimeField(null=True, blank=True)
    security_grade = models.CharField(max_length=10, blank=True, default="A")

    class Meta:
        ordering = ["-created_at"]
        db_table = "ssl_monitor_certificate"
        unique_together = ("organization", "domain")

    def __str__(self):
        return f"{self.domain}:{self.port} (expires: {self.expiration_date})"