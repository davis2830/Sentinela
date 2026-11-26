from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class DomainInfo(OrganizationOwnedModel):
    """Stores WHOIS / RDAP information for a monitored domain.

    Updated by the scan_whois Celery task.
    Supports manual expiration fallback for TLDs without reliable RDAP/WHOIS,
    plus registrar / nameserver / transfer-lock change tracking.
    """

    domain = models.CharField(max_length=500)
    registrar = models.CharField(max_length=500, blank=True)
    creation_date = models.DateTimeField(null=True, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    manual_expiration_date = models.DateField(null=True, blank=True)
    last_updated = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=500, blank=True)
    name_servers = models.TextField(blank=True)
    registrant_country = models.CharField(max_length=100, blank=True)
    days_until_expiration = models.IntegerField(null=True, blank=True)
    is_locked = models.BooleanField(default=None, null=True)
    whois_server = models.CharField(max_length=255, blank=True)
    dnssec = models.CharField(max_length=100, blank=True)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    data_source = models.CharField(max_length=20, blank=True)
    source_url = models.URLField(max_length=2048, blank=True)
    last_successful_at = models.DateTimeField(null=True, blank=True)
    last_change_at = models.DateTimeField(null=True, blank=True)
    changes_acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "domain_info"
        unique_together = ("organization", "domain")

    def __str__(self):
        return f"{self.domain} (expires: {self.expiration_date or self.manual_expiration_date})"


class DomainChangeHistory(BaseModel):
    """Audit log of security-relevant registration changes (registrar, NS, transfer lock)."""

    class FieldName(models.TextChoices):
        REGISTRAR = "registrar", "Registrador"
        NAME_SERVERS = "name_servers", "Nameservers"
        IS_LOCKED = "is_locked", "Bloqueo de transferencia"
        EXPIRATION_DATE = "expiration_date", "Fecha de vencimiento"

    domain_info = models.ForeignKey(
        DomainInfo,
        on_delete=models.CASCADE,
        related_name="change_history",
    )
    field_name = models.CharField(max_length=40, choices=FieldName.choices)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]
        db_table = "domain_change_history"

    def __str__(self):
        return f"{self.domain_info.domain} {self.field_name} changed @ {self.changed_at}"
