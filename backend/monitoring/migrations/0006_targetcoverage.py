import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("monitoring", "0005_monitoringtarget_runner_type_agentprobe_and_more"),
        ("ssl_monitor", "0003_sslcertificate_issued_at_sslcertificate_port_and_more"),
        ("domain", "0002_domaininfo_dnssec_domaininfo_is_locked_and_more"),
        ("dns_monitor", "0002_dnsrecord_response_time_ms_and_more"),
        ("security_headers", "0002_enhance_security_headers"),
    ]
    operations = [migrations.CreateModel(
        name="TargetCoverage",
        fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("target", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="coverage", to="monitoring.monitoringtarget")),
            ("ssl", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="ssl_monitor.sslcertificate")),
            ("domain", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="domain.domaininfo")),
            ("security", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="security_headers.securityheadertarget")),
            ("dns", models.ManyToManyField(blank=True, to="dns_monitor.dnsrecord")),
        ],
        options={"ordering": ["-created_at"], "abstract": False},
    )]
