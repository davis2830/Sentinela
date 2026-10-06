# Durable scan admission shared by all operational entry points.

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('organizations', '0006_free_registration_defaults'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScanLease',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resource_key', models.CharField(max_length=255, unique=True)),
                ('token', models.UUIDField(null=True)),
                ('started', models.BooleanField(default=False)),
                ('pending_until', models.DateTimeField(null=True)),
                ('next_allowed_at', models.DateTimeField(null=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(class)ss', to='organizations.organization')),
            ],
            options={
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
    ]
