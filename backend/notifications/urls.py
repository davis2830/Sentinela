from django.urls import path

from .views import (
    NotificationChannelDetailView,
    NotificationChannelListView,
    NotificationDetailView,
    NotificationListView,
)

urlpatterns = [
    # Channels
    path("channels/", NotificationChannelListView.as_view(), name="notification_channel_list"),
    path(
        "channels/<uuid:channel_id>/",
        NotificationChannelDetailView.as_view(),
        name="notification_channel_detail",
    ),
    # Notifications
    path("", NotificationListView.as_view(), name="notification_list"),
    path(
        "<uuid:notification_id>/",
        NotificationDetailView.as_view(),
        name="notification_detail",
    ),
]