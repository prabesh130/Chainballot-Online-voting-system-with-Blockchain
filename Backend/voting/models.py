# voting/models.py
from django.db import models
from voter.models import Voter


class BlindSignature(models.Model):
    voter = models.OneToOneField(
        Voter,
        on_delete=models.CASCADE
    )
    blinded_hash = models.CharField(
        max_length=64,
        unique=True
    )
    issued_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"BlindSignature(voter={self.voter.id})"
