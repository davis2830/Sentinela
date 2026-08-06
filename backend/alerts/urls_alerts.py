from django.urls import path

from .views import AlertDetailView, AlertListView

urlpatterns = [
    path("", AlertListView.as_view(), name="alert_list"),
    path("<uuid:alert_id>/", AlertDetailView.as_view(), name="alert_detail"),
]