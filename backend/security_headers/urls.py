from django.urls import path

from .views import (
    SecurityHeaderBulkActionView,
    SecurityHeaderBulkScanView,
    SecurityHeaderResultListView,
    SecurityHeaderStatsView,
    SecurityHeaderTargetDetailView,
    SecurityHeaderTargetListView,
    SecurityHeaderTargetScanView,
    SecurityHeaderTestView,
)

urlpatterns = [
    path("", SecurityHeaderTargetListView.as_view(), name="security_header_target_list"),
    path("stats/", SecurityHeaderStatsView.as_view(), name="security_header_stats"),
    path("scan-all/", SecurityHeaderBulkScanView.as_view(), name="security_header_bulk_scan"),
    path("test-headers/", SecurityHeaderTestView.as_view(), name="security_header_test"),
    path("bulk-action/", SecurityHeaderBulkActionView.as_view(), name="security_header_bulk_action"),
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