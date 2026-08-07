from django.urls import path

from .views import (
    DomainDetailView,
    DomainExpiredView,
    DomainExpiringSoonView,
    DomainListView,
    DomainScanView,
)

urlpatterns = [
    path("", DomainListView.as_view(), name="domain_list"),
    path("expiring/", DomainExpiringSoonView.as_view(), name="domain_expiring_soon"),
    path("expired/", DomainExpiredView.as_view(), name="domain_expired"),
    path("<uuid:domain_id>/", DomainDetailView.as_view(), name="domain_detail"),
    path("<uuid:domain_id>/scan/", DomainScanView.as_view(), name="domain_scan"),
]