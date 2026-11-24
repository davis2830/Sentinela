from django.urls import include, path

from .views import (
    AgentProbeDetailView,
    AgentProbeListView,
    AgentProbeRotateTokenView,
)

from .probe_views import ProbeReadView, ProbeInstallationView, ProbeRevokeView

urlpatterns = [
    path("", include("monitoring.urls_agent_transport")),
    path("<uuid:probe_id>/detail/", ProbeReadView.as_view()),
    path("<uuid:probe_id>/installation/", ProbeInstallationView.as_view()),
    path("<uuid:probe_id>/revoke/", ProbeRevokeView.as_view()),
    path("", AgentProbeListView.as_view(), name="agent_probe_list"),
    path("<uuid:probe_id>/", AgentProbeDetailView.as_view(), name="agent_probe_detail"),
    path("<uuid:probe_id>/rotate-token/", AgentProbeRotateTokenView.as_view(), name="agent_probe_rotate_token"),
]
