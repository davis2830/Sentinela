from django.urls import path

from .views import (
    AlertBulkActionView,
    AlertBulkAcknowledgeView,
    AlertBulkResolveView,
    AlertCreateIncidentView,
    AlertDetailView,
    AlertListView,
    AlertSnoozeView,
    AlertStatsView,
)

urlpatterns = [
    path("", AlertListView.as_view(), name="alert_list"),
    path("stats/", AlertStatsView.as_view(), name="alert_stats"),
    path("acknowledge-all/", AlertBulkAcknowledgeView.as_view(), name="alert_acknowledge_all"),
    path("resolve-all/", AlertBulkResolveView.as_view(), name="alert_resolve_all"),
    path("bulk-action/", AlertBulkActionView.as_view(), name="alert_bulk_action"),
    path("<uuid:alert_id>/", AlertDetailView.as_view(), name="alert_detail"),
    path("<uuid:alert_id>/snooze/", AlertSnoozeView.as_view(), name="alert_snooze"),
    path("<uuid:alert_id>/create-incident/", AlertCreateIncidentView.as_view(), name="alert_create_incident"),
]