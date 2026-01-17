import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from student.models import Student
from voter.models import Voter, VoterOTP
import random
import hashlib

def generate_otp():
    return f"{random.randint(100000, 999999)}"

def hash_otp(otp: str):
    return hashlib.sha256(otp.encode()).hexdigest()


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"detail": "CSRF cookie set"})

@csrf_exempt
def voter_register(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    data = json.loads(request.body)
    roll = data.get("crn")
    email = data.get("email")
    password = data.get("password")
    password2 = data.get("password2")

    if password != password2:
        return JsonResponse({"error": "Passwords do not match"}, status=400)

    student = get_object_or_404(Student, roll=roll, email=email)

    if hasattr(student, "voter"):
        return JsonResponse({"error": "Already registered"}, status=400)

    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        is_staff=False,
        is_superuser=False,
    )

    voter = Voter.objects.create(
        user=user,
        student=student
    )

    verification_link = f"http://127.0.0.1:8000/voter/verify/{voter.verification_token}/"

    send_mail(
        "Verify your voter account",
        f"Click to verify:\n{verification_link}",
        settings.DEFAULT_FROM_EMAIL,
        [email],
    )

    return JsonResponse(
        {"message": "Registered. Check email to verify."},
        status=201
    )

def verify_email(request, token):
    voter = get_object_or_404(Voter, verification_token=token)

    if not voter.is_verified:
        voter.is_verified = True
        voter.save()

    return redirect("http://localhost:5173/emailVerified")

def dev_verify_voter(request, roll):
    if not settings.DEBUG:
        return JsonResponse({"error": "Not allowed"}, status=403)

    voter = get_object_or_404(Voter, student__roll=roll)
    voter.is_verified = True
    voter.save()

    return JsonResponse({"verified": True})

@csrf_exempt
def voter_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    data = json.loads(request.body)
    email = data.get("email")
    password = data.get("password")

    user = authenticate(username=email, password=password)

    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    if not hasattr(user, "voter"):
        return JsonResponse({"error": "Not a voter"}, status=403)

    if not user.voter.is_verified:
        return JsonResponse({"error": "Email not verified"}, status=403)
    
    otp = generate_otp()
    otp_hash = hash_otp(otp)
    VoterOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    VoterOTP.objects.create(
        user=user,
        otp_hash=otp_hash
    )
    send_mail(
        subject="Your ChainBallot Login OTP",
        message=f"Your OTP is {otp}. It expires in 5 minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )
    return JsonResponse({
        "otp_required": True,
        "message": "OTP sent to your email"
    })
    
@csrf_exempt
@require_http_methods(["POST"])
def verify_voter_otp(request):
    data = json.loads(request.body)
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        return JsonResponse({"error": "Email and OTP required"}, status=400)

    try:
        user = User.objects.get(username=email)
        otp_entry = VoterOTP.objects.filter(
            user=user,
            is_used=False
        ).latest("created_at")
    except:
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    if otp_entry.is_expired():
        otp_entry.is_used = True
        otp_entry.save()
        return JsonResponse({"error": "OTP expired"}, status=400)

    if otp_entry.otp_hash != hash_otp(otp):
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    # ✅ OTP VALID
    otp_entry.is_used = True
    otp_entry.save()

    # 🔥 LOGIN HERE (SESSION STORED)
    login(request, user)

    return JsonResponse({"success": True})


from django.views.decorators.http import require_http_methods

@require_http_methods(["POST"])
def voter_logout(request):
    logout(request)
    return JsonResponse({"success": True})

@login_required
def voter_profile(request):
    voter = request.user.voter
    return JsonResponse({
        "authenticated": True,
        "email": request.user.email,
        "roll": voter.student.roll,
        "name": voter.student.name,
        "is_voted": voter.is_voted,
        "is_verified": voter.is_verified,
    })

