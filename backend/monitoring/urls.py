from django.urls import path

from .views import (
    MonitoringCheckListView,
    MonitoringTargetDetailView,
    MonitoringTargetListView,
    MonitoringUptimeView,
)

urlpatterns = [
    path("", MonitoringTargetListView.as_view(), name="target_list"),
    path("<uuid:target_id>/", MonitoringTargetDetailView.as_view(), name="target_detail"),
    path("<uuid:target_id>/checks/", MonitoringCheckListView.as_view(), name="target_checks"),
    path("<uuid:target_id>/uptime/", MonitoringUptimeView.as_view(), name="target_uptime"),
]