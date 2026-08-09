from django.urls import path
from .views import (
    StatusPageConfigView,
    MaintenanceListView,
    MaintenanceDetailView,
    PublicStatusPageView,
)

urlpatterns = [
    path("config/", StatusPageConfigView.as_view(), name="status_page_config"),
    path("maintenances/", MaintenanceListView.as_view(), name="maintenance_list"),
    path(
        "maintenances/<uuid:maintenance_id>/",
        MaintenanceDetailView.as_view(),
        name="maintenance_detail",
    ),
    path("public/<str:slug>/", PublicStatusPageView.as_view(), name="public_status_page"),
]
