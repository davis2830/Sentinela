from unittest.mock import patch
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from accounts.models import User
from organizations.models import Organization
from common.security import validate_safe_target_endpoint, validate_agent_target_endpoint
from .models import AgentProbe, MonitoringTarget


class NetworkSyntaxTests(SimpleTestCase):
    def test_agent_accepts_lan_hostname_without_cloud_dns_lookup(self):
        with patch('common.security.socket.getaddrinfo',side_effect=AssertionError('LAN name must resolve only on agent')):
            self.assertEqual(validate_agent_target_endpoint('db.lan:5432'),'db.lan:5432')
            self.assertEqual(validate_agent_target_endpoint('fd00::10'),'[fd00::10]')
            self.assertEqual(validate_agent_target_endpoint('[fd00::10]:5432'),'[fd00::10]:5432')

    def test_invalid_ports_and_protected_literals_still_rejected(self):
        for value in ('host:0','host:65536','host:not-port','host:',
                      '[::ffff:127.0.0.1]:80','[::ffff:169.254.169.254]:80','[::1]:80',
                      '[fd00:ec2::254]:80','metadata.google.internal','localhost.','user:secret@host:80'):
            with self.subTest(value=value),self.assertRaises(ValidationError):validate_agent_target_endpoint(value)

    def test_cloud_keeps_resolution_and_all_address_ssrf_validation(self):
        answers=[(2,1,6,'',('8.8.8.8',80)),(10,1,6,'',('fd00::10',80,0,0))]
        with patch('common.security.socket.getaddrinfo',return_value=answers) as resolve:
            with self.assertRaises(ValidationError):validate_safe_target_endpoint('mixed.example.test')
        resolve.assert_called_once()


class AgentNetworkAPITests(TestCase):
    def setUp(self):
        self.org=Organization.objects.create(name='Agent network',slug='agent-network',plan_tier='pro',beta_managed=False)
        self.admin=User.objects.create_user('network-admin@example.test',organization=self.org,is_staff=True,email_verified_at=timezone.now())
        _,hashed=AgentProbe.generate_token()
        self.probe=AgentProbe.objects.create(organization=self.org,name='LAN',token_hash=hashed)
        self.client=APIClient();self.client.force_authenticate(self.admin)

    def create(self,endpoint,**extra):
        data={'name':'LAN check','endpoint':endpoint,'target_type':'tcp','runner_type':'agent',
              'agent_probe':str(self.probe.pk),'enabled':False,'related_modules':[],**extra}
        with patch('monitoring.tasks.register_target_in_submonitors.delay'):
            return self.client.post('/api/v1/monitoring/',data,format='json')

    def test_create_ipv6_and_edit_lan_hostname_without_resolving_on_backend(self):
        with patch('common.security.socket.getaddrinfo',side_effect=AssertionError('No cloud resolution')):
            response=self.create('fd00::10')
            self.assertEqual(response.status_code,201,response.data)
            target=MonitoringTarget.objects.get(pk=response.data['data']['id'])
            self.assertEqual(target.endpoint,'[fd00::10]')
            response=self.client.patch(f'/api/v1/monitoring/{target.pk}/',{'endpoint':'db.lan:5432'},format='json')
            self.assertEqual(response.status_code,200,response.data)
            target.refresh_from_db();self.assertEqual(target.endpoint,'db.lan:5432')

    def test_cloud_cannot_bypass_boundaries_by_attaching_probe_id(self):
        response=self.create('10.0.0.1:80',runner_type='cloud')
        self.assertEqual(response.status_code,400)

    def test_foreign_or_absent_agent_rejected(self):
        foreign=Organization.objects.create(name='Other network',slug='other-network',beta_managed=False)
        _,hashed=AgentProbe.generate_token()
        probe=AgentProbe.objects.create(organization=foreign,name='Other',token_hash=hashed)
        for value in (str(probe.pk),None):
            self.assertEqual(self.create('db.lan:5432',agent_probe=value).status_code,400)

    def test_switch_to_cloud_revalidates_existing_private_destination(self):
        target=MonitoringTarget.objects.create(organization=self.org,name='LAN',endpoint='[fd00::10]:5432',
            target_type='tcp',runner_type='agent',agent_probe=self.probe,enabled=False)
        response=self.client.patch(f'/api/v1/monitoring/{target.pk}/',{'runner_type':'cloud','agent_probe':None},format='json')
        self.assertEqual(response.status_code,400)
        target.refresh_from_db();self.assertEqual(target.runner_type,'agent')

    def test_dns_rejects_literal_or_port_but_accepts_lan_hostname(self):
        for value in ('10.0.0.1','[fd00::10]','dns.lan:53'):
            self.assertEqual(self.create(value,target_type='dns').status_code,400)
        self.assertEqual(self.create('service.lan',target_type='dns').status_code,201)
