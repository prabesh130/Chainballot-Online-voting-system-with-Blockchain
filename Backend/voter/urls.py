# registered/urls.py
from django.urls import path
from .views import voter_register, VoterRetrieveUpdateDeleteView, verify_email

urlpatterns = [
    path('register/', voter_register, name='register_voter'),
    path('verify/<uuid:token>/', verify_email),
    path('<int:pk>/', VoterRetrieveUpdateDeleteView.as_view(), name='voter_detail'),
]
