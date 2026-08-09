from django.urls import path

from .views import (
    NotificationChannelDetailView,
    NotificationChannelListView,
    NotificationChannelTestView,
    NotificationDetailView,
    NotificationListView,
    NotificationStatsView,
)

urlpatterns = [
    # Channels
    path("stats/", NotificationStatsView.as_view(), name="notification_stats"),
    path("channels/", NotificationChannelListView.as_view(), name="notification_channel_list"),
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
]