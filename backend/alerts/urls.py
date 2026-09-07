from django.urls import path

from .views import (
    AlertRuleDetailView,
    AlertRuleEvaluateView,
    AlertRuleListView,
    AlertRuleSimulateView,
    AlertRuleSnoozeView,
)

urlpatterns = [
    path("", AlertRuleListView.as_view(), name="alert_rule_list"),
    path("evaluate/", AlertRuleEvaluateView.as_view(), name="alert_rule_evaluate"),
    path("simulate/", AlertRuleSimulateView.as_view(), name="alert_rule_simulate"),
    path("<uuid:rule_id>/", AlertRuleDetailView.as_view(), name="alert_rule_detail"),
    path("<uuid:rule_id>/snooze/", AlertRuleSnoozeView.as_view(), name="alert_rule_snooze"),
]