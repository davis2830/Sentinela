# Generated manually for security headers enhancement
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security_headers', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='securityheadertarget',
            name='last_grade',
            field=models.CharField(blank=True, default='', max_length=5),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='last_response_time_ms',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='has_hsts',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='has_csp',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='has_xfo',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='info_leak_detected',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='server_header',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='securityheadertarget',
            name='powered_by_header',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='securityheaderresult',
            name='response_time_ms',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='securityheaderresult',
            name='directives_analysis',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='securityheaderresult',
            name='info_leaks',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
