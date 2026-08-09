from django.urls import path

from .views import (
    ReportDetailView,
    ReportListView,
    ReportExportCSVView,
    ReportExportPDFView,
)

urlpatterns = [
    path("", ReportListView.as_view(), name="report_list"),
    path("<uuid:report_id>/", ReportDetailView.as_view(), name="report_detail"),
    path("<uuid:report_id>/export/csv/", ReportExportCSVView.as_view(), name="report_export_csv"),
    path("<uuid:report_id>/export/pdf/", ReportExportPDFView.as_view(), name="report_export_pdf"),
]