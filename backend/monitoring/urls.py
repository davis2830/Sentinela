from django.urls import path

from .views import (
    MonitoringCheckListView,
    MonitoringTargetDetailView,
    MonitoringTargetListView,
    MonitoringTargetScanView,
    MonitoringTargetBulkScanView,
    MonitoringUptimeView,
    MonitoringTimeseriesView,
    GlobalSearchView,
    MonitoringTargetExportView,
    MaintenanceWindowListView,
    MaintenanceWindowDetailView,
    TestConnectionView,
    BulkActionView,
)

urlpatterns = [
    path("", MonitoringTargetListView.as_view(), name="target_list"),
    path("scan-all/", MonitoringTargetBulkScanView.as_view(), name="target_bulk_scan"),
    path("bulk-action/", BulkActionView.as_view(), name="target_bulk_action"),
    path("test-connection/", TestConnectionView.as_view(), name="target_test_connection"),
    path("search/", GlobalSearchView.as_view(), name="global_search"),
    path("<uuid:target_id>/", MonitoringTargetDetailView.as_view(), name="target_detail"),
    path("<uuid:target_id>/checks/", MonitoringCheckListView.as_view(), name="target_checks"),
    path("<uuid:target_id>/uptime/", MonitoringUptimeView.as_view(), name="target_uptime"),
    path("<uuid:target_id>/timeseries/", MonitoringTimeseriesView.as_view(), name="target_timeseries"),
    path("<uuid:target_id>/scan/", MonitoringTargetScanView.as_view(), name="target_scan"),
    path("<uuid:target_id>/export/", MonitoringTargetExportView.as_view(), name="target_export"),
    path("<uuid:target_id>/maintenance-windows/", MaintenanceWindowListView.as_view(), name="maintenance_list"),
    path("maintenance-windows/<uuid:window_id>/", MaintenanceWindowDetailView.as_view(), name="maintenance_detail"),
]