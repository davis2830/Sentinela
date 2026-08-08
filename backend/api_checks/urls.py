from django.urls import path

from .views import (
    APICheckBulkScanView,
    APICheckResultListView,
    APICheckStatsView,
    APICheckTargetDetailView,
    APICheckTargetListView,
    APICheckTargetScanView,
)

urlpatterns = [
    path("", APICheckTargetListView.as_view(), name="api_check_target_list"),
    path("stats/", APICheckStatsView.as_view(), name="api_check_stats"),
    path("scan-all/", APICheckBulkScanView.as_view(), name="api_check_bulk_scan"),
    path("<uuid:target_id>/", APICheckTargetDetailView.as_view(), name="api_check_target_detail"),
    path("<uuid:target_id>/scan/", APICheckTargetScanView.as_view(), name="api_check_target_scan"),
    path("<uuid:target_id>/results/", APICheckResultListView.as_view(), name="api_check_results"),
]