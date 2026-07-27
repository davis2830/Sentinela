from django.urls import path

from .views import (
    SecurityHeaderResultListView,
    SecurityHeaderTargetDetailView,
    SecurityHeaderTargetListView,
)

urlpatterns = [
    path("", SecurityHeaderTargetListView.as_view(), name="security_header_target_list"),
    path(
        "<uuid:target_id>/",
        SecurityHeaderTargetDetailView.as_view(),
        name="security_header_target_detail",
    ),
    path(
        "<uuid:target_id>/results/",
        SecurityHeaderResultListView.as_view(),
        name="security_header_results",
    ),
]