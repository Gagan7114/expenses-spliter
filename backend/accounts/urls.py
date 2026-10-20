from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/password-reset/", views.password_reset),
    path("auth/password-reset/confirm/", views.password_reset_confirm),
    path("users/check-id/", views.check_user_id),
    path("users/search/", views.search_users),
    path("me/", views.MeView.as_view()),
]
