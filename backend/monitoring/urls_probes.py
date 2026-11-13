from django.urls import path

from .views import (
    AgentProbeDetailView,
    AgentProbeHeartbeatView,
    AgentProbeListView,
    AgentProbeSubmitResultsView,
    AgentProbeRotateTokenView,
)

from .probe_views import ProbeReadView, ProbeInstallationView, ProbeRevokeView, ProbeDiagnosticView

urlpatterns = [
    path("diagnostic/", ProbeDiagnosticView.as_view()),
    path("<uuid:probe_id>/detail/", ProbeReadView.as_view()),
    path("<uuid:probe_id>/installation/", ProbeInstallationView.as_view()),
    path("<uuid:probe_id>/revoke/", ProbeRevokeView.as_view()),
    path("", AgentProbeListView.as_view(), name="agent_probe_list"),
    path("heartbeat/", AgentProbeHeartbeatView.as_view(), name="agent_probe_heartbeat"),
    path("submit-results/", AgentProbeSubmitResultsView.as_view(), name="agent_probe_submit_results"),
    path("<uuid:probe_id>/", AgentProbeDetailView.as_view(), name="agent_probe_detail"),
    path("<uuid:probe_id>/rotate-token/", AgentProbeRotateTokenView.as_view(), name="agent_probe_rotate_token"),
]
