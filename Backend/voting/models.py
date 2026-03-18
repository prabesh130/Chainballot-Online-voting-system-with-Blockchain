# voting/models.py
from django.db import models
from django.utils import timezone
from voter.models import Voter


class ElectionState(models.Model):
    STATUS_NOT_STARTED = "not_started"
    STATUS_ACTIVE = "active"
    STATUS_ENDED = "ended"

    STATUS_CHOICES = [
        (STATUS_NOT_STARTED, "Not Started"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_ENDED, "Ended"),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_NOT_STARTED,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ElectionState(status={self.status})"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    @property
    def is_active(self):
        return self.status == self.STATUS_ACTIVE

    def start(self):
        self.status = self.STATUS_ACTIVE
        self.started_at = timezone.now()
        self.ended_at = None
        self.save(update_fields=["status", "started_at", "ended_at", "updated_at"])

    def end(self):
        self.status = self.STATUS_ENDED
        self.ended_at = timezone.now()
        self.save(update_fields=["status", "ended_at", "updated_at"])


class Candidate(models.Model):
    POST_PRESIDENT = "President"
    POST_VICE_PRESIDENT = "Vice President"
    POST_SECRETARY = "Secretary"
    POST_VICE_SECRETARY = "Vice Secretary"

    POST_CHOICES = [
        (POST_PRESIDENT, "President"),
        (POST_VICE_PRESIDENT, "Vice President"),
        (POST_SECRETARY, "Secretary"),
        (POST_VICE_SECRETARY, "Vice Secretary"),
    ]

    name = models.CharField(max_length=100)
    post = models.CharField(max_length=50, choices=POST_CHOICES)
    photo_url = models.URLField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["post", "name"]
        unique_together = ("name", "post")

    def __str__(self):
        return f"{self.name} ({self.post})"


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
