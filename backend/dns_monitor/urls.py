from django.urls import path

from .views import (
    DNSBulkActionView,
    DNSBulkScanView,
    DNSChangeHistoryView,
    DNSDomainsView,
    DNSRecordDetailView,
    DNSRecordListView,
    DNSRecordScanView,
    DNSStatsView,
    DNSTestResolutionView,
)

urlpatterns = [
    path("", DNSRecordListView.as_view(), name="dns_record_list"),
    path("stats/", DNSStatsView.as_view(), name="dns_stats"),
    path("scan-all/", DNSBulkScanView.as_view(), name="dns_bulk_scan"),
    path("test-resolution/", DNSTestResolutionView.as_view(), name="dns_test_resolution"),
    path("bulk-action/", DNSBulkActionView.as_view(), name="dns_bulk_action"),
    path("domains/", DNSDomainsView.as_view(), name="dns_domains"),
    path("<uuid:record_id>/", DNSRecordDetailView.as_view(), name="dns_record_detail"),
    path(
        "<uuid:record_id>/scan/",
        DNSRecordScanView.as_view(),
        name="dns_record_scan",
    ),
    path(
        "<uuid:record_id>/history/",
        DNSChangeHistoryView.as_view(),
        name="dns_change_history",
    ),
]