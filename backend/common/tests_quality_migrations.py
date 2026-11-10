from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.exceptions import IrreversibleError
from django.test import TransactionTestCase


class AuthorizationMigrationTests(TransactionTestCase):
    def test_existing_users_remain_legacy_and_custom_blocks_rollback(self):
        executor = MigrationExecutor(connection)
        executor.migrate([("accounts", "0009_disposabledomainpolicy")])
        try:
            old_apps = executor.loader.project_state([("accounts", "0009_disposabledomainpolicy")]).apps
            old_user = old_apps.get_model("accounts", "User").objects.create(email="migration@quality.test")
            executor = MigrationExecutor(connection)
            executor.migrate([("accounts", "0010_user_authorization_mode")])
            apps = executor.loader.project_state([("accounts", "0010_user_authorization_mode")]).apps
            user = apps.get_model("accounts", "User").objects.get(pk=old_user.pk)
            self.assertEqual(user.authorization_mode, "legacy")
            user.authorization_mode = "custom"
            user.save()
            with self.assertRaises(IrreversibleError):
                MigrationExecutor(connection).migrate([("accounts", "0009_disposabledomainpolicy")])
            user.authorization_mode = "legacy"
            user.save()
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())


class BetaFeedbackMigrationTests(TransactionTestCase):
    def test_existing_beta_control_survives_additive_feedback_fields(self):
        executor = MigrationExecutor(connection)
        leaves = executor.loader.graph.leaf_nodes()
        before = [("accounts", "0010_user_authorization_mode")]
        executor.migrate(before)
        try:
            old_apps = executor.loader.project_state(before).apps
            control, _ = old_apps.get_model("accounts", "BetaControl").objects.get_or_create(pk=1)
            control.capacity = 37
            control.admissions_open = False
            control.save()
            user = old_apps.get_model("accounts", "User").objects.create(email="feedback-migration@quality.test")
            executor = MigrationExecutor(connection)
            executor.migrate([("accounts", "0011_betacontrol_feedback_links")])
            apps = executor.loader.project_state([("accounts", "0011_betacontrol_feedback_links")]).apps
            upgraded = apps.get_model("accounts", "BetaControl").objects.get(pk=control.pk)
            self.assertEqual((upgraded.capacity, upgraded.admissions_open), (37, False))
            self.assertEqual((upgraded.feedback_submission_url, upgraded.feedback_management_url), ("", ""))
            self.assertEqual(apps.get_model("accounts", "User").objects.get(pk=user.pk).authorization_mode, "legacy")
        finally:
            MigrationExecutor(connection).migrate(leaves)
