# authentication/models.py
from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    number = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} Profile"
