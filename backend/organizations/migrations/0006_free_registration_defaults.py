from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organizations", "0005_alter_organization_metrics_retention_days")]
    operations = [
        migrations.AlterField(model_name="organization", name="plan_tier", field=models.CharField(choices=[("free", "Free / Community"), ("pro", "Pro / Growth"), ("business", "Business"), ("enterprise", "Enterprise")], default="free", help_text="Current subscription tier.", max_length=20)),
        migrations.AlterField(model_name="organization", name="subscription_status", field=models.CharField(choices=[("trialing", "Trialing"), ("active", "Active"), ("past_due", "Past Due"), ("canceled", "Canceled")], default="active", help_text="Billing subscription status.", max_length=20)),
        migrations.AlterField(model_name="organization", name="default_scan_interval_seconds", field=models.IntegerField(default=300, help_text="Default interval for monitoring checks in seconds.")),
    ]
