from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class DNSRecord(OrganizationOwnedModel):
    """Represents a DNS record being monitored for a domain.

    Stores the current value, TTL, and last change timestamp.
    Updated by the scan_dns_records Celery task.
    """

    class RecordType(models.TextChoices):
        A = "A", "A"
        AAAA = "AAAA", "AAAA"
        MX = "MX", "MX"
        TXT = "TXT", "TXT"
        NS = "NS", "NS"
        CNAME = "CNAME", "CNAME"

    domain = models.CharField(max_length=500)
    record_type = models.CharField(
        max_length=10,
        choices=RecordType.choices,
    )
    value = models.TextField(blank=True)
    ttl = models.IntegerField(null=True, blank=True)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    last_change_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "dns_monitor_record"
        unique_together = ("organization", "domain", "record_type")

    def __str__(self):
        return f"{self.domain} {self.record_type} -> {self.value[:50]}"


class DNSChangeHistory(BaseModel):
    """Tracks changes to DNS records over time.

    Each time a DNS record value changes, a new entry is created
    to maintain a full audit trail of modifications.
    """

    record = models.ForeignKey(
        DNSRecord,
        on_delete=models.CASCADE,
        related_name="change_history",
    )
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]
        db_table = "dns_monitor_change_history"

    def __str__(self):
        return f"{self.record.domain} {self.record.record_type} change @ {self.changed_at}"
