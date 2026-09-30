from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_backup_codes_user_is_2fa_enabled_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='totp_secret',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
