from django.db import models
from student.models import Student  
import uuid

class Voter(models.Model):
    student = models.OneToOneField(
        Student,
        on_delete=models.CASCADE,
        related_name='voter'
    )
    registered_at = models.DateTimeField(auto_now_add=True)
    password = models.CharField(max_length=128)
    is_voted = models.BooleanField(default=False)

    is_verified = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True)

    def __str__(self):
        return str(self.student.roll)
