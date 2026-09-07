from django.urls import path

from .views import (
    NotificationChannelBulkActionView,
    NotificationChannelDetailView,
    NotificationChannelListView,
    NotificationChannelTestView,
    NotificationDetailView,
    NotificationExportCsvView,
    NotificationListView,
    NotificationRetryView,
    NotificationStatsView,
    NotificationTestConnectionView,
)

urlpatterns = [
    # Channels
    path("stats/", NotificationStatsView.as_view(), name="notification_stats"),
    path("test-connection/", NotificationTestConnectionView.as_view(), name="notification_test_connection"),
    path("export-csv/", NotificationExportCsvView.as_view(), name="notification_export_csv"),
    path("channels/", NotificationChannelListView.as_view(), name="notification_channel_list"),
    path(
        "channels/bulk-action/",
        NotificationChannelBulkActionView.as_view(),
        name="notification_channel_bulk_action",
    ),
    path(
        "channels/<uuid:channel_id>/",
        NotificationChannelDetailView.as_view(),
        name="notification_channel_detail",
    ),
    path(
        "channels/<uuid:channel_id>/test/",
        NotificationChannelTestView.as_view(),
        name="notification_channel_test",
    ),
    # Notifications
    path("", NotificationListView.as_view(), name="notification_list"),
    path(
        "<uuid:notification_id>/",
        NotificationDetailView.as_view(),
        name="notification_detail",
    ),
    path(
        "<uuid:notification_id>/retry/",
        NotificationRetryView.as_view(),
        name="notification_retry",
    ),
]