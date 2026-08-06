from django.urls import path

from .views import AuditLogDetailView, AuditLogListView

urlpatterns = [
    path("", AuditLogListView.as_view(), name="audit_log_list"),
    path("<uuid:log_id>/", AuditLogDetailView.as_view(), name="audit_log_detail"),
]