from django.urls import path
from .views import sign_blind_vote

urlpatterns = [
    path("api/sign-blind-vote/", sign_blind_vote),
]
