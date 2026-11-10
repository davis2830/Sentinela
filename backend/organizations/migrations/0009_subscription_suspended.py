from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('organizations', '0008_organization_is_test')]
    operations = [migrations.AlterField(model_name='organization', name='subscription_status',
        field=models.CharField(max_length=20, default='active', help_text='Billing subscription status.',
            choices=[('trialing','Trialing'),('active','Active'),('past_due','Past Due'),('canceled','Canceled'),('suspended','Suspended')]))]
