from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization

from .models import Role, UserRole


class UserAdministrationAccessTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Alpha", slug="alpha")
        self.other_org = Organization.objects.create(name="Beta", slug="beta")
        self.member = User.objects.create_user(email="member@example.test", password="test-pass", organization=self.org)
        self.admin = User.objects.create_user(
            email="admin@example.test", password="test-pass", organization=self.org, is_staff=True
        )
        self.target = User.objects.create_user(email="target@example.test", password="test-pass", organization=self.org)
        self.foreign_role = Role.objects.create(name="Foreign admin", organization=self.other_org)
        self.client = APIClient()

    def test_member_cannot_create_admin_or_assign_roles(self):
        self.client.force_authenticate(self.member)
        create = self.client.post(
            "/api/v1/users/",
            {"email": "newadmin@example.test", "password": "test-pass", "role": "admin"},
            format="json",
        )
        self.assertEqual(create.status_code, 403)
        self.assertFalse(User.objects.filter(email="newadmin@example.test").exists())

        assign = self.client.post(
            f"/api/v1/users/{self.target.id}/roles/", {"role_id": str(self.foreign_role.id)}, format="json"
        )
        self.assertEqual(assign.status_code, 403)
        self.assertFalse(UserRole.objects.filter(user=self.target).exists())

        promote = self.client.patch(
            f"/api/v1/users/{self.member.id}/", {"role": "admin"}, format="json"
        )
        self.assertEqual(promote.status_code, 403)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_staff)

        create_role = self.client.post("/api/v1/users/roles/", {"name": "Administrator"}, format="json")
        self.assertEqual(create_role.status_code, 403)

    def test_admin_cannot_assign_role_from_another_organization(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/users/{self.target.id}/roles/", {"role_id": str(self.foreign_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(UserRole.objects.filter(user=self.target).exists())

    def test_admin_cannot_assign_local_role_to_foreign_user(self):
        foreign_user = User.objects.create_user(
            email="foreign@example.test", password="test-pass", organization=self.other_org
        )
        local_role = Role.objects.create(name="Operator", organization=self.org)
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/users/{foreign_user.id}/roles/", {"role_id": str(local_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(UserRole.objects.filter(user=foreign_user).exists())

    def test_admin_can_assign_role_within_organization(self):
        local_role = Role.objects.create(name="Operator", organization=self.org)
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/users/{self.target.id}/roles/", {"role_id": str(local_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(UserRole.objects.filter(user=self.target, role=local_role).exists())
