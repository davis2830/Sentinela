from django.urls import path
from .views import (
    StatusPageListView,
    StatusPageDetailView,
    StatusPageSetDefaultView,
    StatusPageConfigView,
    StatusPageStatsView,
    StatusPageAvailableTargetsView,
    MaintenanceListView,
    MaintenanceDetailView,
    MaintenanceUpdateView,
    MaintenanceBulkActionView,
    SubscriberListView,
    SubscriberDeleteView,
    SubscriberExportCSVView,
    PublicStatusPageView,
    PublicSubscribeView,
    PublicUnsubscribeView,
)

urlpatterns = [
    # Multi-Status Pages Management
    path("pages/", StatusPageListView.as_view(), name="status_page_list"),
    path("pages/<uuid:page_id>/set-default/", StatusPageSetDefaultView.as_view(), name="status_page_set_default"),
    path("pages/<uuid:page_id>/", StatusPageDetailView.as_view(), name="status_page_detail"),

    # Admin Config & Telemetry
    path("config/", StatusPageConfigView.as_view(), name="status_page_config"),
    path("stats/", StatusPageStatsView.as_view(), name="status_page_stats"),
    path("available-targets/", StatusPageAvailableTargetsView.as_view(), name="status_page_available_targets"),

    # Maintenances
    path("maintenances/bulk-action/", MaintenanceBulkActionView.as_view(), name="maintenance_bulk_action"),
    path("maintenances/", MaintenanceListView.as_view(), name="maintenance_list"),
    path("maintenances/<uuid:maintenance_id>/updates/", MaintenanceUpdateView.as_view(), name="maintenance_update"),
    path("maintenances/<uuid:maintenance_id>/", MaintenanceDetailView.as_view(), name="maintenance_detail"),

    # Subscribers
    path("subscribers/export/", SubscriberExportCSVView.as_view(), name="subscriber_export"),
    path("subscribers/<uuid:subscriber_id>/", SubscriberDeleteView.as_view(), name="subscriber_delete"),
    path("subscribers/", SubscriberListView.as_view(), name="subscriber_list"),

    # Public Endpoints
    path("public/<str:slug>/subscribe/", PublicSubscribeView.as_view(), name="public_subscribe"),
    path("public/<str:slug>/unsubscribe/", PublicUnsubscribeView.as_view(), name="public_unsubscribe"),
    path("public/<str:slug>/", PublicStatusPageView.as_view(), name="public_status_page"),
]
