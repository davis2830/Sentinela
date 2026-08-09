from django.urls import path

from .views import (
    SecurityHeaderBulkScanView,
    SecurityHeaderResultListView,
    SecurityHeaderStatsView,
    SecurityHeaderTargetDetailView,
    SecurityHeaderTargetListView,
    SecurityHeaderTargetScanView,
)

urlpatterns = [
    path("", SecurityHeaderTargetListView.as_view(), name="security_header_target_list"),
    path("stats/", SecurityHeaderStatsView.as_view(), name="security_header_stats"),
    path("scan-all/", SecurityHeaderBulkScanView.as_view(), name="security_header_bulk_scan"),
    path(
        "<uuid:target_id>/",
        SecurityHeaderTargetDetailView.as_view(),
        name="security_header_target_detail",
    ),
    path(
        "<uuid:target_id>/scan/",
        SecurityHeaderTargetScanView.as_view(),
        name="security_header_target_scan",
    ),
    path(
        "<uuid:target_id>/results/",
        SecurityHeaderResultListView.as_view(),
        name="security_header_results",
    ),
]