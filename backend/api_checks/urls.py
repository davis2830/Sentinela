from django.urls import path

from .views import (
    APICheckBulkActionView,
    APICheckBulkScanView,
    APICheckResultListView,
    APICheckStatsView,
    APICheckTargetDetailView,
    APICheckTargetListView,
    APICheckTargetScanView,
    APICheckTestRequestView,
)

urlpatterns = [
    path("", APICheckTargetListView.as_view(), name="api_check_target_list"),
    path("stats/", APICheckStatsView.as_view(), name="api_check_stats"),
    path("scan-all/", APICheckBulkScanView.as_view(), name="api_check_bulk_scan"),
    path("test-request/", APICheckTestRequestView.as_view(), name="api_check_test_request"),
    path("bulk-action/", APICheckBulkActionView.as_view(), name="api_check_bulk_action"),
    path("<uuid:target_id>/", APICheckTargetDetailView.as_view(), name="api_check_target_detail"),
    path("<uuid:target_id>/scan/", APICheckTargetScanView.as_view(), name="api_check_target_scan"),
    path("<uuid:target_id>/results/", APICheckResultListView.as_view(), name="api_check_results"),
]