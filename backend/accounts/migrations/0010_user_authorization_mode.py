from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def require_legacy_users(apps, schema_editor):
    if apps.get_model("accounts", "User").objects.filter(authorization_mode="custom").exists():
        raise IrreversibleError("No se puede retirar la autorización granular mientras existan usuarios custom. Revisa su acceso mediante el flujo administrativo auditado.")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0009_disposabledomainpolicy")]
    operations = [migrations.AddField(model_name="user", name="authorization_mode",
                  field=models.CharField(max_length=10, choices=[("legacy", "Legacy"), ("custom", "Personalizado")], default="legacy")),
                  migrations.RunPython(migrations.RunPython.noop, require_legacy_users)]
