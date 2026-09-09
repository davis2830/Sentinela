from django.urls import path

from .views import (
    APITokenDetailView,
    APITokenListView,
    ChangePasswordView,
    Login2FAView,
    LoginView,
    LogoutView,
    MeView,
    RefreshTokenView,
    RegisterView,
    RevokeSessionsView,
    TwoFactorDisableView,
    TwoFactorSetupView,
    TwoFactorVerifyView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("login/2fa/", Login2FAView.as_view(), name="login_2fa"),
    path("register/", RegisterView.as_view(), name="register"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("password/change/", ChangePasswordView.as_view(), name="change_password"),
    path("revoke-sessions/", RevokeSessionsView.as_view(), name="revoke_sessions"),
    path("me/", MeView.as_view(), name="me"),
    path("2fa/setup/", TwoFactorSetupView.as_view(), name="2fa_setup"),
    path("2fa/verify/", TwoFactorVerifyView.as_view(), name="2fa_verify"),
    path("2fa/disable/", TwoFactorDisableView.as_view(), name="2fa_disable"),
    path("api-tokens/", APITokenListView.as_view(), name="api_token_list"),
    path("api-tokens/<uuid:token_id>/", APITokenDetailView.as_view(), name="api_token_detail"),
]