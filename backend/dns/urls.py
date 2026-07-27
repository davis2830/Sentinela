from django.urls import path

from .views import (
    DNSChangeHistoryView,
    DNSDomainsView,
    DNSRecordDetailView,
    DNSRecordListView,
)

urlpatterns = [
    path("", DNSRecordListView.as_view(), name="dns_record_list"),
    path("domains/", DNSDomainsView.as_view(), name="dns_domains"),
    path("<uuid:record_id>/", DNSRecordDetailView.as_view(), name="dns_record_detail"),
    path(
        "<uuid:record_id>/history/",
        DNSChangeHistoryView.as_view(),
        name="dns_change_history",
    ),
]