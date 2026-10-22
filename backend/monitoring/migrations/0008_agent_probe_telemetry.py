from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('monitoring', '0007_agent_execution_delivery')]
    operations = [
        migrations.AddField(model_name='agentprobe', name='operational_snapshot',
                            field=models.JSONField(null=True, blank=True)),
        migrations.AddField(model_name='agentprobe', name='telemetry_received_at',
                            field=models.DateTimeField(null=True, blank=True)),
    ]
