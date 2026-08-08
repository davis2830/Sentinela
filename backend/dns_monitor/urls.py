from django.urls import path

from .views import (
    DNSBulkScanView,
    DNSChangeHistoryView,
    DNSDomainsView,
    DNSRecordDetailView,
    DNSRecordListView,
    DNSRecordScanView,
    DNSStatsView,
)

urlpatterns = [
    path("", DNSRecordListView.as_view(), name="dns_record_list"),
    path("stats/", DNSStatsView.as_view(), name="dns_stats"),
    path("scan-all/", DNSBulkScanView.as_view(), name="dns_bulk_scan"),
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