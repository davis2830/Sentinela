from django.urls import path

from .views import (
    MaintenanceWindowBulkActionView,
    MaintenanceWindowCancelView,
    MaintenanceWindowCompleteView,
    MaintenanceWindowDetailView,
    MaintenanceWindowListView,
    MaintenanceWindowProgressUpdateView,
    MaintenanceWindowStartView,
    MaintenanceWindowStatsView,
)

urlpatterns = [
    path("stats/", MaintenanceWindowStatsView.as_view(), name="maintenance_stats"),
    path("bulk-action/", MaintenanceWindowBulkActionView.as_view(), name="maintenance_bulk_action"),
    path("", MaintenanceWindowListView.as_view(), name="maintenance_list"),
    path("<uuid:window_id>/", MaintenanceWindowDetailView.as_view(), name="maintenance_detail"),
    path("<uuid:window_id>/start/", MaintenanceWindowStartView.as_view(), name="maintenance_start"),
    path("<uuid:window_id>/complete/", MaintenanceWindowCompleteView.as_view(), name="maintenance_complete"),
    path("<uuid:window_id>/cancel/", MaintenanceWindowCancelView.as_view(), name="maintenance_cancel"),
    path("<uuid:window_id>/updates/", MaintenanceWindowProgressUpdateView.as_view(), name="maintenance_updates"),
]
