from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from organizations.models import Organization
from audit.models import AuditLog


class PlatformAuditFiltersTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Audit customer', slug='audit-customer')
        self.root = User.objects.create_user('root@example.test', is_superuser=True, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.root)
        self.url = '/api/v1/platform-admin/audit-logs/'

    def test_combined_filters_and_pagination(self):
        for _ in range(26):
            AuditLog.objects.create(organization_id=self.org.id, user_email='support@example.test',
                                    action='update', module='accounts', result='failure')
        AuditLog.objects.create(user_email='other@example.test', action='login', module='accounts')
        filters = dict(page=1, email='support', organization='audit-customer', result='failure', action='update')
        response = self.client.get(self.url, filters)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['data']['events']), 25)
        self.assertTrue(response.data['data']['has_next'])
        filters['page'] = 2
        second = self.client.get(self.url, filters).data['data']
        self.assertEqual(len(second['events']), 1)
        self.assertFalse(second['has_next'])
        self.assertNotIn(second['events'][0]['id'], [row['id'] for row in response.data['data']['events']])

    def test_invalid_range_and_page(self):
        self.assertEqual(self.client.get(self.url, {'page': 0}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'page': 1, 'since': '2026-11-09T00:00:00Z',
                                                   'until': '2026-11-08T00:00:00Z'}).status_code, 400)

    def test_non_superadmin_cannot_search_global_audit(self):
        self.root.is_superuser = False
        self.root.save(update_fields=['is_superuser'])
        self.assertEqual(self.client.get(self.url, {'page': 1, 'organization': 'audit'}).status_code, 403)
