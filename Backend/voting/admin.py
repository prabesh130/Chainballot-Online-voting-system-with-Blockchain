from django.contrib import admin
from .models import BlindSignature, Candidate, ElectionState


@admin.register(ElectionState)
class ElectionStateAdmin(admin.ModelAdmin):
	list_display = ("id", "status", "started_at", "ended_at", "updated_at")


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
	list_display = ("name", "post", "is_active", "created_at")
	list_filter = ("post", "is_active")
	search_fields = ("name",)


@admin.register(BlindSignature)
class BlindSignatureAdmin(admin.ModelAdmin):
	list_display = ("voter", "issued_at")
