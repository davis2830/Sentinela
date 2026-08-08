from django.urls import path

from .views import (
    AlertBulkAcknowledgeView,
    AlertBulkResolveView,
    AlertCreateIncidentView,
    AlertDetailView,
    AlertListView,
    AlertStatsView,
)

urlpatterns = [
    path("", AlertListView.as_view(), name="alert_list"),
    path("stats/", AlertStatsView.as_view(), name="alert_stats"),
    path("acknowledge-all/", AlertBulkAcknowledgeView.as_view(), name="alert_acknowledge_all"),
    path("resolve-all/", AlertBulkResolveView.as_view(), name="alert_resolve_all"),
    path("<uuid:alert_id>/", AlertDetailView.as_view(), name="alert_detail"),
    path("<uuid:alert_id>/create-incident/", AlertCreateIncidentView.as_view(), name="alert_create_incident"),
]