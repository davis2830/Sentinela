from django.urls import path

from .views import (
    SSLCertificateDetailView,
    SSLCertificateListView,
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
]