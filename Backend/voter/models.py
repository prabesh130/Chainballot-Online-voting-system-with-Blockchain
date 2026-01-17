from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from student.models import Student
import uuid

class Voter(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    student = models.OneToOneField(
        Student,
        on_delete=models.CASCADE,
        related_name="voter"
    )

    registered_at = models.DateTimeField(auto_now_add=True)
    is_voted = models.BooleanField(default=False)

    is_verified = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True)

    def __str__(self):
        return str(self.student.roll)

class VoterOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(default=timezone.now)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return (timezone.now() - self.created_at).seconds > 300  # 5 minutes