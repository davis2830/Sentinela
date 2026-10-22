from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User
from audit.models import AuditLog
from organizations.models import Organization
from .models import AgentProbe, MonitoringTarget
from .services import AgentProbeService


class ProbeSecurityTests(TestCase):
    def setUp(self):
        self.org=Organization.objects.create(name='Probe security',slug='probe-security',beta_managed=False)
        self.raw,hashed=AgentProbe.generate_token()
        self.probe=AgentProbe.objects.create(organization=self.org,name='Private',token_hash=hashed)
        self.admin=User.objects.create_user('security-admin@example.test',organization=self.org,is_staff=True,email_verified_at=timezone.now())
        self.viewer=User.objects.create_user('security-viewer@example.test',organization=self.org,email_verified_at=timezone.now())
        self.client=APIClient()
        self.url=f'/api/v1/agent-probes/{self.probe.pk}/rotate-token/'

    def test_rotation_invalidates_old_token_reveals_once_and_logs_no_secret(self):
        self.client.force_authenticate(self.admin)
        response=self.client.post(self.url,{},format='json')
        self.assertEqual(response.status_code,200)
        new=response.data['data']['raw_token']
        self.assertIsNone(AgentProbeService.authenticate_token(self.raw))
        self.assertEqual(AgentProbeService.authenticate_token(new).id,self.probe.id)
        self.probe.refresh_from_db()
        self.assertNotEqual(self.probe.token_hash,new)
        self.assertEqual(response['Cache-Control'],'no-store')
        listed=self.client.get('/api/v1/agent-probes/')
        self.assertNotIn(new,str(listed.data));self.assertNotIn('token_hash',str(listed.data))
        self.assertEqual(AuditLog.objects.filter(organization_id=self.org.pk).count(),1)
        self.assertNotIn(new,str(list(AuditLog.objects.filter(organization_id=self.org.pk).values())))

    def test_viewer_and_foreign_admin_cannot_rotate(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,403)
        other=Organization.objects.create(name='Foreign',slug='probe-security-foreign',beta_managed=False)
        admin=User.objects.create_user('foreign-security@example.test',organization=other,is_staff=True,email_verified_at=timezone.now())
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,404)
        self.assertIsNotNone(AgentProbeService.authenticate_token(self.raw))

    def test_online_probe_and_pending_results_block_rotation(self):
        self.client.force_authenticate(self.admin)
        self.probe.last_heartbeat=timezone.now();self.probe.save()
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,409)
        target=MonitoringTarget.objects.create(organization=self.org,name='Private API',runner_type='agent',agent_probe=self.probe,endpoint='https://example.test')
        self.assertTrue(AgentProbeService.process_heartbeat(self.probe,delivery_protocol=2))
        AgentProbe.objects.filter(pk=self.probe.pk).update(last_heartbeat=timezone.now()-timedelta(minutes=2))
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,409)
        self.assertIsNotNone(AgentProbeService.authenticate_token(self.raw))

    def test_install_template_never_embeds_secret_or_uses_latest(self):
        self.client.force_authenticate(self.admin)
        with patch('organizations.services.QuotaService.check_quota'):
            response=self.client.post('/api/v1/agent-probes/',{'name':'Install fixture'},format='json')
        self.assertEqual(response.status_code,201)
        data=response.data['data']
        self.assertNotIn(data['raw_token'],data['docker_command'])
        self.assertIn('SENTININE_TOKEN_FILE',data['docker_command'])
        self.assertIn('--user 10001:10001',data['docker_command'])
        self.assertNotIn(':latest',data['docker_command'])
        self.assertEqual(response['Cache-Control'],'no-store')
