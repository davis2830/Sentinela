from django.urls import path

from .views import (
    IncidentAlertsView,
    IncidentDetailView,
    IncidentListView,
    IncidentTimelineView,
)

urlpatterns = [
    path("", IncidentListView.as_view(), name="incident_list"),
    path("<uuid:incident_id>/", IncidentDetailView.as_view(), name="incident_detail"),
    path("<uuid:incident_id>/timeline/", IncidentTimelineView.as_view(), name="incident_timeline"),
    path("<uuid:incident_id>/alerts/", IncidentAlertsView.as_view(), name="incident_alerts"),
]