from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import ContactUsMessage

@csrf_exempt  # ok for now; use CSRF token in production
def contact_us(request):
    if request.method == "POST":
        name = request.POST.get("name")
        email = request.POST.get("email")
        message = request.POST.get("message")

        if not name or not email or not message:
            return JsonResponse(
                {"error": "All fields are required"},
                status=400
            )

        ContactUsMessage.objects.create(
            name=name,
            email=email,
            message=message
        )

        return JsonResponse(
            {"success": True, "message": "Message stored successfully"}
        )

    return JsonResponse({"error": "Invalid request method"}, status=405)
