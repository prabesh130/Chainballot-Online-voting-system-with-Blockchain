from django.urls import path
from .views import RegisterView

urlpatterns = [
    path("api/register/", RegisterView.as_view(), name="register"),
    # path("profile/", ProfileView.as_view(), name="profile"),
]
