from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organizations", "0004_alter_organization_allowed_ip_ranges_and_more")]

    operations = [
        migrations.AlterField(
            model_name="organization",
            name="metrics_retention_days",
            field=models.IntegerField(
                default=90,
                help_text="Days to retain historical telemetry in PostgreSQL.",
            ),
        ),
    ]
