from django.urls import path

from .views import (
    AgentProbeDetailView,
    AgentProbeHeartbeatView,
    AgentProbeListView,
    AgentProbeSubmitResultsView,
    AgentProbeRotateTokenView,
)

urlpatterns = [
    path("", AgentProbeListView.as_view(), name="agent_probe_list"),
    path("heartbeat/", AgentProbeHeartbeatView.as_view(), name="agent_probe_heartbeat"),
    path("submit-results/", AgentProbeSubmitResultsView.as_view(), name="agent_probe_submit_results"),
    path("<uuid:probe_id>/", AgentProbeDetailView.as_view(), name="agent_probe_detail"),
    path("<uuid:probe_id>/rotate-token/", AgentProbeRotateTokenView.as_view(), name="agent_probe_rotate_token"),
]
