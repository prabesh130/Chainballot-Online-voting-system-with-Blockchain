from django.urls import path
from .views import (
    get_verified_voters,
    send_credentials_email,
    voter_register,
    voter_login,
    voter_logout,
    voter_profile,
    verify_email,
    dev_verify_voter,
    csrf,
    verify_voter_otp,
    admin_login,
    check_admin_auth,
    admin_logout,
)

urlpatterns = [
    path("register/", voter_register),
    path("login/", voter_login),
    path("logout/", voter_logout),
    path("profile/", voter_profile),
    path("verify/<uuid:token>/", verify_email),
    path("dev-verify/<str:roll>/", dev_verify_voter),
    path("csrf/", csrf),
    path("verify-otp/", verify_voter_otp),
    path("admin/verified-voters/", get_verified_voters, name="verified_voters"),
    path("admin/send-credentials/", send_credentials_email, name="send_credentials"),
    path("admin/login/", admin_login, name="admin_login"),
    path("admin/check-auth/", check_admin_auth, name="check_admin_auth"),
    path("admin/logout/", admin_logout, name="admin_logout"),
]
