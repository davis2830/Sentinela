from django.urls import path

from .views import (
    ReportBulkActionView,
    ReportDetailView,
    ReportExportCSVView,
    ReportExportPDFView,
    ReportListView,
    ReportLiveSLAMetricsView,
)

urlpatterns = [
    path("", ReportListView.as_view(), name="report_list"),
    path("sla-live/", ReportLiveSLAMetricsView.as_view(), name="report_sla_live"),
    path("bulk-action/", ReportBulkActionView.as_view(), name="report_bulk_action"),
    path("<uuid:report_id>/", ReportDetailView.as_view(), name="report_detail"),
    path("<uuid:report_id>/export/csv/", ReportExportCSVView.as_view(), name="report_export_csv"),
    path("<uuid:report_id>/export/pdf/", ReportExportPDFView.as_view(), name="report_export_pdf"),
]