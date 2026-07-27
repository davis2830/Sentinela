from django.db import models

from common.models import OrganizationOwnedModel


class DomainInfo(OrganizationOwnedModel):
    """Stores WHOIS information for a monitored domain.

    Updated by the scan_whois Celery task.
    Used for domain expiration alerts and registrar change detection.
    """

    domain = models.CharField(max_length=500)
    registrar = models.CharField(max_length=500, blank=True)
    creation_date = models.DateTimeField(null=True, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=500, blank=True)
    name_servers = models.TextField(blank=True)
    registrant_country = models.CharField(max_length=100, blank=True)
    days_until_expiration = models.IntegerField(null=True, blank=True)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "domain_info"
        unique_together = ("organization", "domain")

    def __str__(self):
        return f"{self.domain} (expires: {self.expiration_date})"