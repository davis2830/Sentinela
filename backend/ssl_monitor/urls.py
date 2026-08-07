from django.urls import path

from .views import (
    SSLCertificateDetailView,
    SSLCertificateListView,
    SSLCertificateScanView,
    SSLExpiredView,
    SSLExpiringSoonView,
)

urlpatterns = [
    path("", SSLCertificateListView.as_view(), name="ssl_certificate_list"),
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