from django.urls import path

from .views import ReportDetailView, ReportListView

urlpatterns = [
    path("", ReportListView.as_view(), name="report_list"),
    path("<uuid:report_id>/", ReportDetailView.as_view(), name="report_detail"),
]