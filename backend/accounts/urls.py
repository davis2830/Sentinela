from django.urls import path

from .views import (
    APITokenDetailView,
    APITokenListView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    RefreshTokenView,
    RegisterView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("register/", RegisterView.as_view(), name="register"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("password/change/", ChangePasswordView.as_view(), name="change_password"),
    path("me/", MeView.as_view(), name="me"),
    path("api-tokens/", APITokenListView.as_view(), name="api_token_list"),
    path("api-tokens/<uuid:token_id>/", APITokenDetailView.as_view(), name="api_token_detail"),
]