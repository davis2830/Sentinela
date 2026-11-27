from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitoring", "0011_agentprobe_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitoringtarget",
            name="alert_after_failures",
            field=models.PositiveSmallIntegerField(
                default=2,
                help_text="Consecutive failed checks required before triggering a down alert.",
            ),
        ),
    ]
