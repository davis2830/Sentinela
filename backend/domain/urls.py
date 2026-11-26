from django.urls import path

from .views import (
    DomainAcknowledgeChangesView,
    DomainBulkActionView,
    DomainBulkScanView,
    DomainChangeHistoryView,
    DomainDetailView,
    DomainExpiredView,
    DomainExpiringSoonView,
    DomainListView,
    DomainScanView,
    DomainStatsView,
    DomainSuggestionsView,
    DomainTestWhoisView,
)

urlpatterns = [
    path("", DomainListView.as_view(), name="domain_list"),
    path("stats/", DomainStatsView.as_view(), name="domain_stats"),
    path("suggestions/", DomainSuggestionsView.as_view(), name="domain_suggestions"),
    path("scan-all/", DomainBulkScanView.as_view(), name="domain_bulk_scan"),
    path("test-whois/", DomainTestWhoisView.as_view(), name="domain_test_whois"),
    path("bulk-action/", DomainBulkActionView.as_view(), name="domain_bulk_action"),
    path("expiring/", DomainExpiringSoonView.as_view(), name="domain_expiring_soon"),
    path("expired/", DomainExpiredView.as_view(), name="domain_expired"),
    path("<uuid:domain_id>/", DomainDetailView.as_view(), name="domain_detail"),
    path("<uuid:domain_id>/scan/", DomainScanView.as_view(), name="domain_scan"),
    path("<uuid:domain_id>/history/", DomainChangeHistoryView.as_view(), name="domain_history"),
    path(
        "<uuid:domain_id>/acknowledge-changes/",
        DomainAcknowledgeChangesView.as_view(),
        name="domain_acknowledge_changes",
    ),
]
