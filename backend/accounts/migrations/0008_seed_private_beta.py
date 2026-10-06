from django.db import migrations


def seed(apps, schema_editor):
    # Closed by default. No verification timestamps or org ownership are inferred.
    apps.get_model("accounts", "BetaControl").objects.get_or_create(
        id=1, defaults={"capacity": 20, "admissions_open": False})


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_abusebucket_betacontrol_user_email_verified_at_and_more"),
        ("organizations", "0007_organization_beta_managed_organization_beta_status"),
    ]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
