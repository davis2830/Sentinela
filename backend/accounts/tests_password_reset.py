from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from common.crypto import decrypt_string
from organizations.models import Organization
from .models import User, IdentityMail
from .password_reset import tokens


@override_settings(DEBUG=True, TURNSTILE_SECRET_KEY='', PUBLIC_APP_URL='http://localhost:3001')
class PasswordRecoveryTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Recovery fixture', slug='recovery-fixture')
        self.user = User.objects.create_user(email='recovery@example.test', password='Initial-secret-592!',
            organization=self.org, verification_required=True, email_verified_at=timezone.now(), is_staff=True)
        self.client = APIClient()

    def secret(self):
        return f'{urlsafe_base64_encode(force_bytes(self.user.pk))}.{tokens.make_token(self.user)}'

    def confirm(self, token, password='Replacement-secret-941!'):
        return self.client.post('/api/v1/auth/password/reset/', {'token': token, 'password': password}, format='json')

    def test_request_queues_encrypted_link_and_does_not_authenticate(self):
        response = self.client.post('/api/v1/auth/password/recovery/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 202)
        mail = IdentityMail.objects.get()
        self.assertNotIn('#token=', mail.encrypted_body)
        self.assertIn('http://localhost:3001/reset-password#token=', decrypt_string(mail.encrypted_body))
        self.assertNotIn('access_token', response.data)

    def test_unknown_and_unverified_have_same_response_without_mail(self):
        self.user.email_verified_at = None
        self.user.save(update_fields=['email_verified_at'])
        a = self.client.post('/api/v1/auth/password/recovery/', {'email': self.user.email}, format='json')
        b = self.client.post('/api/v1/auth/password/recovery/', {'email': 'absent@example.test'}, format='json')
        self.assertEqual(a.status_code, b.status_code)
        self.assertEqual(a.data, b.data)
        self.assertFalse(IdentityMail.objects.exists())
        self.assertEqual(self.confirm(self.secret()).status_code, 400)

    def test_reset_is_single_use_revokes_refresh_and_preserves_mfa_and_plan(self):
        self.user.is_2fa_enabled = True
        self.user.totp_secret = 'encrypted-fixture-secret'
        self.user.backup_codes = ['fixture-hash']
        self.user.save(update_fields=['is_2fa_enabled', 'totp_secret', 'backup_codes'])
        refresh = RefreshToken.for_user(self.user)
        secret = self.secret()
        self.assertEqual(self.confirm(secret).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Replacement-secret-941!'))
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh['jti']).exists())
        self.assertEqual(self.confirm(secret).status_code, 400)
        self.assertTrue(self.user.is_2fa_enabled)
        self.assertEqual(self.user.totp_secret, 'encrypted-fixture-secret')
        self.assertEqual(self.user.backup_codes, ['fixture-hash'])
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan_tier, 'free')

    def test_expired_token_and_inactive_account_cannot_reset(self):
        with patch.object(tokens, '_now', return_value=tokens._now() - timedelta(hours=2)):
            old = self.secret()
        self.assertEqual(self.confirm(old).status_code, 400)
        fresh = self.secret()
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertEqual(self.confirm(fresh).status_code, 400)

    def test_weak_password_keeps_token_valid_for_retry(self):
        secret = self.secret()
        self.assertEqual(self.confirm(secret, '123').status_code, 400)
        self.assertEqual(self.confirm(secret).status_code, 200)

    def test_blacklist_failure_rolls_back_password(self):
        RefreshToken.for_user(self.user)
        with patch.object(BlacklistedToken.objects, 'get_or_create', side_effect=RuntimeError('fixture failure')):
            with self.assertRaises(RuntimeError):
                self.confirm(self.secret())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Initial-secret-592!'))
        self.assertFalse(BlacklistedToken.objects.exists())

    def test_malformed_tokens_return_400(self):
        for token in ['bad', 'bad.invalid', 'bm90LWEtdXVpZA.invalid']:
            self.assertEqual(self.confirm(token).status_code, 400)

    def test_email_budget_and_captcha_are_enforced(self):
        for _ in range(3):
            self.assertEqual(self.client.post('/api/v1/auth/password/recovery/', {'email': 'absent@example.test'}, format='json').status_code, 202)
        self.assertEqual(self.client.post('/api/v1/auth/password/recovery/', {'email': 'absent@example.test'}, format='json').status_code, 429)
        with override_settings(TURNSTILE_SECRET_KEY='configured-secret'):
            self.assertEqual(self.client.post('/api/v1/auth/password/recovery/', {'email': self.user.email}, format='json').status_code, 400)
        self.assertFalse(OutstandingToken.objects.exists())

    def test_link_cannot_be_rebound_to_another_user(self):
        other = User.objects.create_user(email='other-recovery@example.test', password='Original-test-841!',
            organization=self.org, verification_required=False)
        forged = f'{urlsafe_base64_encode(force_bytes(other.pk))}.{tokens.make_token(self.user)}'
        self.assertEqual(self.confirm(forged).status_code, 400)
        other.refresh_from_db()
        self.assertTrue(other.check_password('Original-test-841!'))

    def test_invalid_email_format_never_queues_recovery_mail(self):
        for email in ['', 'correo', 'nombre@', 'nombre@empresa', 'nombre@@empresa.com']:
            response = self.client.post('/api/v1/auth/password/recovery/', {'email': email}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertFalse(IdentityMail.objects.exists())


@override_settings(DEBUG=True)
class PasswordResetConcurrencyTests(TransactionTestCase):
    def test_only_one_concurrent_confirmation_consumes_the_link(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections, connections
        org = Organization.objects.create(name='Concurrent recovery', slug='concurrent-recovery')
        user = User.objects.create_user(email='concurrent-reset@example.test', password='Original-test-291!',
            organization=org, verification_required=False)
        secret = f'{urlsafe_base64_encode(force_bytes(user.pk))}.{tokens.make_token(user)}'
        barrier = Barrier(2)

        def confirm():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return APIClient().post('/api/v1/auth/password/reset/', {
                    'token': secret, 'password': 'Concurrent-test-password-591!'}, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: confirm(), range(2)))
        self.assertEqual(sorted(results), [200, 400])
