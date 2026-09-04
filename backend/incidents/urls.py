from django.urls import path

from .views import (
    IncidentAlertsView,
    IncidentAssignView,
    IncidentBulkActionView,
    IncidentDetailView,
    IncidentListView,
    IncidentRCAView,
    IncidentStatsView,
    IncidentTimelineView,
)

urlpatterns = [
    path("", IncidentListView.as_view(), name="incident_list"),
    path("stats/", IncidentStatsView.as_view(), name="incident_stats"),
    path("bulk-action/", IncidentBulkActionView.as_view(), name="incident_bulk_action"),
    path("<uuid:incident_id>/", IncidentDetailView.as_view(), name="incident_detail"),
    path("<uuid:incident_id>/timeline/", IncidentTimelineView.as_view(), name="incident_timeline"),
    path("<uuid:incident_id>/alerts/", IncidentAlertsView.as_view(), name="incident_alerts"),
    path("<uuid:incident_id>/rca/", IncidentRCAView.as_view(), name="incident_rca"),
    path("<uuid:incident_id>/assign/", IncidentAssignView.as_view(), name="incident_assign"),
]