from django.urls import path
from .views import (
    voter_register,
    voter_login,
    voter_logout,
    voter_profile,
    verify_email,
    dev_verify_voter,
    csrf,
    verify_voter_otp,
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

]
