from django.urls import path

from .views import AlertRuleDetailView, AlertRuleListView

urlpatterns = [
    path("", AlertRuleListView.as_view(), name="alert_rule_list"),
    path("<uuid:rule_id>/", AlertRuleDetailView.as_view(), name="alert_rule_detail"),
]