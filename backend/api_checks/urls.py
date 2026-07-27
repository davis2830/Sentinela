from django.urls import path

from .views import (
    APICheckResultListView,
    APICheckTargetDetailView,
    APICheckTargetListView,
)

urlpatterns = [
    path("", APICheckTargetListView.as_view(), name="api_check_target_list"),
    path("<uuid:target_id>/", APICheckTargetDetailView.as_view(), name="api_check_target_detail"),
    path("<uuid:target_id>/results/", APICheckResultListView.as_view(), name="api_check_results"),
]