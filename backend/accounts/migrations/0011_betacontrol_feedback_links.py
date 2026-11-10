from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0010_user_authorization_mode")]
    operations = [
        migrations.AddField(
            model_name="betacontrol",
            name="feedback_submission_url",
            field=models.URLField(max_length=2048, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="betacontrol",
            name="feedback_management_url",
            field=models.URLField(max_length=2048, blank=True, default=""),
        ),
    ]
