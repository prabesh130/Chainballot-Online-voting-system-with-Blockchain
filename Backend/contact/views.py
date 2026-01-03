import json
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import ContactUsMessage

@csrf_exempt
def contact_us(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)  # <-- read JSON
            name = data.get("name")
            email = data.get("email")
            message = data.get("message")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        if not name or not email or not message:
            return JsonResponse({"error": "All fields are required"}, status=400)

        ContactUsMessage.objects.create(
            name=name,
            email=email,
            message=message,
            created_at=timezone.now()  # since managed=False
        )

        return JsonResponse({"success": True, "message": "Message stored successfully"})

    return JsonResponse({"error": "Invalid request method"}, status=405)
