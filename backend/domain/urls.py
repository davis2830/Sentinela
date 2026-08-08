from django.urls import path

from .views import (
    DomainBulkScanView,
    DomainDetailView,
    DomainExpiredView,
    DomainExpiringSoonView,
    DomainListView,
    DomainScanView,
    DomainStatsView,
)

urlpatterns = [
    path("", DomainListView.as_view(), name="domain_list"),
    path("stats/", DomainStatsView.as_view(), name="domain_stats"),
    path("scan-all/", DomainBulkScanView.as_view(), name="domain_bulk_scan"),
    path("expiring/", DomainExpiringSoonView.as_view(), name="domain_expiring_soon"),
    path("expired/", DomainExpiredView.as_view(), name="domain_expired"),
    path("<uuid:domain_id>/", DomainDetailView.as_view(), name="domain_detail"),
    path("<uuid:domain_id>/scan/", DomainScanView.as_view(), name="domain_scan"),
]