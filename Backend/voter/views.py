# from django.shortcuts import render, redirect
# from django.contrib import messages
from rest_framework import generics
from voter.serializers import VoterSerializer
# from .form import VoterRegistrationForm
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings
from student.models import Student
from voter.models import Voter
from django.shortcuts import redirect, get_object_or_404



@csrf_exempt
def voter_register(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=400)

    data = json.loads(request.body)
    roll = data.get('crn')
    email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')

    if password != password2:
        return JsonResponse({"error": "Passwords do not match"}, status=400)

    try:
        student = Student.objects.get(roll=roll, email=email)
    except Student.DoesNotExist:
        return JsonResponse({"error": "Invalid roll or email"}, status=404)

    if hasattr(student, 'voter'):
        return JsonResponse({"error": "Already registered"}, status=400)

    voter = Voter.objects.create(
        student=student,
        password=make_password(password)
    )

    verification_link = (
        f"http://127.0.0.1:8000/voter/verify/{voter.verification_token}/"
    )

    send_mail(
        subject="Verify your Voter Registration",
        message=f"Click the link to verify your account:\n{verification_link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[student.email],
        fail_silently=False,
    )

    return JsonResponse({
        "message": "Registration successful. Check your email to verify."
    }, status=201)



def verify_email(request, token):
    voter = get_object_or_404(Voter, verification_token=token)

    if not voter.is_verified:
        voter.is_verified = True
        voter.save()

    # redirect to frontend success page
    return redirect("http://localhost:5173/emailVerified")

# Retrieve, update, or delete a student by roll
class VoterRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Voter.objects.all()
    serializer_class = VoterSerializer




# def register_voter(request):
#     if request.method == "POST":
#         email = request.POST.get('email', '').strip()  # get email from form

#         if not email:
#             messages.error(request, "Please enter an email.")
#             return render(request, 'voter/register.html')

#         # Check if email exists in Student table
#         try:
#             student = Student.objects.get(email=email)
#         except Student.DoesNotExist:
#             messages.error(request, "Email not found in student records.")
#             return render(request, 'voter/register.html')

#         # Prevent duplicate registration
#         if Voter.objects.filter(student=student).exists():
#             messages.error(request, "Student already registered.")
#             return render(request, 'voter/register.html')

#         # Create registration
#         Voter.objects.create(student=student)
#         messages.success(request, f"{email} registered successfully!")
#         return redirect('register_voter')  # reload page for new entry

#     return render(request, 'voter/register.html')

# def voter_register(request):
#     if request.method == 'POST':
#         form = VoterRegistrationForm(request.POST)
#         if form.is_valid():
#             form.save()
#             return redirect('registration_success')
#     else:
#         form = VoterRegistrationForm()

#     return render(request, 'voter/register.html', {'form': form})


# def registration_success(request):
#     return render(request, 'voter/success.html')
