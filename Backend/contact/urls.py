from django.urls import path
from .views import contact_us

urlpatterns = [
    path("contactusmessage/", contact_us, name="contactusmessage"),
]
