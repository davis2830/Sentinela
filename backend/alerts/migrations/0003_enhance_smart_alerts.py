# Generated manually for Smart Alerts enhancement
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('alerts', '0002_alertrule_target_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='alertrule',
            name='condition',
            field=models.CharField(
                choices=[
                    ('ssl_expiring', 'SSL Expiring'),
                    ('ssl_grade_below', 'SSL Grade Below'),
                    ('ssl_invalid', 'SSL Invalid'),
                    ('uptime_below', 'Uptime Below'),
                    ('status_down', 'Status Down'),
                    ('response_time_above', 'Response Time Above'),
                    ('dns_changed', 'DNS Changed'),
                    ('dns_latency_above', 'DNS Latency Above'),
                    ('domain_expiring', 'Domain Expiring'),
                    ('domain_unlocked', 'Domain Unlocked'),
                    ('security_score_below', 'Security Score Below'),
                    ('security_leak_detected', 'Security Leak Detected'),
                    ('api_check_failed', 'API Check Failed'),
                    ('api_latency_above', 'API Latency Above'),
                ],
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name='alertrule',
            name='snoozed_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='alertrule',
            name='cooldown_minutes',
            field=models.IntegerField(default=15),
        ),
        migrations.AddField(
            model_name='alertrule',
            name='auto_resolve',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='alert',
            name='occurrence_count',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='alert',
            name='last_seen_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='alert',
            name='is_flapping',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='alert',
            name='flapping_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='alert',
            name='snoozed_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='alert',
            name='auto_resolved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='alert',
            name='metadata',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddIndex(
            model_name='alert',
            index=models.Index(fields=['target_type', 'target_id'], name='alerts_target_idx'),
        ),
    ]
