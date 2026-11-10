from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('organizations', '0007_organization_beta_managed_organization_beta_status')]
    operations = [migrations.AddField(model_name='organization', name='is_test',
                                     field=models.BooleanField(default=False, db_index=True))]
