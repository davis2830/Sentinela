import uuid
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from organizations.models import Organization

from .models import Alert, AlertRule
from .services import AlertService


class AlertLifecycleTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Alpha", slug="alpha")
        self.rule = AlertRule.objects.create(
            organization=self.org,
            name="Target down",
            target_type=AlertRule.TargetType.MONITORING,
            condition=AlertRule.ConditionType.STATUS_DOWN,
            severity=AlertRule.Severity.WARNING,
        )
        self.target_id = uuid.uuid4()

    @patch("notifications.services.NotificationService.send_to_all_channels")
    @patch("alerts.services.AlertService.correlate_alert_with_incident")
    def test_repeat_detection_preserves_first_trigger_and_increments_occurrences(self, _correlate, notify):
        first = AlertService.create_alert(
            self.org.id, self.rule.id, "Down", "First check", "warning",
            target_type="monitoring", target_id=self.target_id, metadata={"first": True},
        )
        triggered_at = first.triggered_at
        second = AlertService.create_alert(
            self.org.id, self.rule.id, "Still down", "Second check", "warning",
            target_type="monitoring", target_id=self.target_id, metadata={"second": True},
        )

        self.assertEqual(second.id, first.id)
        self.assertEqual(Alert.objects.filter(organization=self.org).count(), 1)
        self.assertEqual(second.triggered_at, triggered_at)
        self.assertEqual(second.occurrence_count, 2)
        self.assertEqual(second.metadata, {"first": True, "second": True})
        self.assertGreaterEqual(second.last_seen_at, first.last_seen_at)
        notify.assert_called_once()

    @patch("notifications.services.NotificationService.send_to_all_channels")
    @patch("alerts.services.AlertService.correlate_alert_with_incident")
    def test_third_recent_transition_is_marked_as_flapping(self, _correlate, _notify):
        for number in range(2):
            Alert.objects.create(
                organization=self.org, rule=self.rule, title=f"Past {number}", message="Recovered",
                severity="warning", status=Alert.Status.RESOLVED,
                target_type="monitoring", target_id=self.target_id, resolved_at=timezone.now(),
            )

        alert = AlertService.create_alert(
            self.org.id, self.rule.id, "Down again", "Third transition", "warning",
            target_type="monitoring", target_id=self.target_id,
        )
        self.assertTrue(alert.is_flapping)
        self.assertEqual(alert.flapping_count, 3)
        self.assertEqual(alert.severity, "critical")
