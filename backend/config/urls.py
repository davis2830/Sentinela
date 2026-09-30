from django.contrib import admin
from django.urls import include, path
from common.views_health import HealthCheckView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("health", HealthCheckView.as_view(), name="health-check-noslash"),
    path("admin/", admin.site.urls),
    path("api/v1/", include(("config.api_urls", "api"), namespace="v1")),
]