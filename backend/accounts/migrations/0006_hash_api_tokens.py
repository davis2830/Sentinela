from django.db import migrations, models


def revoke_plaintext_tokens(apps, schema_editor):
    APIToken = apps.get_model("accounts", "APIToken")
    APIToken.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_alter_user_totp_secret")]

    operations = [
        migrations.RunPython(revoke_plaintext_tokens, migrations.RunPython.noop),
        migrations.RemoveField(model_name="apitoken", name="token"),
        migrations.AddField(
            model_name="apitoken",
            name="token_hash",
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.AddField(
            model_name="apitoken",
            name="token_prefix",
            field=models.CharField(db_index=True, max_length=16),
        ),
    ]
