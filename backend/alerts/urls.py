from django.urls import path

from .views import AlertRuleDetailView, AlertRuleEvaluateView, AlertRuleListView

urlpatterns = [
    path("", AlertRuleListView.as_view(), name="alert_rule_list"),
    path("evaluate/", AlertRuleEvaluateView.as_view(), name="alert_rule_evaluate"),
    path("<uuid:rule_id>/", AlertRuleDetailView.as_view(), name="alert_rule_detail"),
]