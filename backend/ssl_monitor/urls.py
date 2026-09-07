from django.urls import path

from .views import (
    SSLBulkActionView,
    SSLBulkScanView,
    SSLCertificateDetailView,
    SSLCertificateListView,
    SSLCertificateScanView,
    SSLExpiredView,
    SSLExpiringSoonView,
    SSLStatsView,
    SSLTestConnectionView,
)

urlpatterns = [
    path("", SSLCertificateListView.as_view(), name="ssl_certificate_list"),
    path("stats/", SSLStatsView.as_view(), name="ssl_stats"),
    path("scan-all/", SSLBulkScanView.as_view(), name="ssl_bulk_scan"),
    path("test-connection/", SSLTestConnectionView.as_view(), name="ssl_test_connection"),
    path("bulk-action/", SSLBulkActionView.as_view(), name="ssl_bulk_action"),
    path("expiring/", SSLExpiringSoonView.as_view(), name="ssl_expiring_soon"),
    path("expired/", SSLExpiredView.as_view(), name="ssl_expired"),
    path(
        "<uuid:certificate_id>/",
        SSLCertificateDetailView.as_view(),
        name="ssl_certificate_detail",
    ),
    path(
        "<uuid:certificate_id>/scan/",
        SSLCertificateScanView.as_view(),
        name="ssl_certificate_scan",
    ),
]