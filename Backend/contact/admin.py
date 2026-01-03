from django.contrib import admin
from .models import ContactUsMessage

@admin.register(ContactUsMessage)
class ContactUsMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "created_at")
    search_fields = ("name", "email")
    ordering = ("-created_at",)
