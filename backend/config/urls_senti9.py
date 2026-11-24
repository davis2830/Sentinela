from django.urls import include, path

urlpatterns = [path("api/v1/agent-probes/", include("monitoring.urls_agent_transport"))]
