"""Public transport used by installed Senti9 agents."""

from django.urls import path

from .probe_views import ProbeDiagnosticView
from .views import AgentProbeHeartbeatView, AgentProbeSubmitResultsView

urlpatterns = [
    path("diagnostic/", ProbeDiagnosticView.as_view()),
    path("heartbeat/", AgentProbeHeartbeatView.as_view(), name="agent_probe_heartbeat"),
    path("submit-results/", AgentProbeSubmitResultsView.as_view(), name="agent_probe_submit_results"),
]
