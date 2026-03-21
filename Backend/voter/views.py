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
from django.db import transaction
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

    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return JsonResponse(
            {"error": "A user with this email already exists. Please login or use a different email."},
            status=400,
        )

    with transaction.atomic():
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

        verification_link = f"https://chainballot-backend.vercel.app/voter/verify/{voter.verification_token}/"

        email_error = None
        try:
            send_mail(
                "Verify your voter account",
                f"Click to verify:\n{verification_link}",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as e:
            email_error = str(e)

    if email_error:
        return JsonResponse(
            {
                "message": "Registered, but verification email could not be sent.",
                "email_error": email_error,
                "verification_token": str(voter.verification_token),
            },
            status=201,
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

    return redirect("https://chainballot-online-voting.vercel.app/emailVerified")

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

    #  OTP VALID
    otp_entry.is_used = True
    otp_entry.save()

    # LOGIN HERE (SESSION STORED)
    login(request, user)

    return JsonResponse({"success": True})


from django.views.decorators.http import require_http_methods

@require_http_methods(["POST"])
def voter_logout(request):
    logout(request)
    return JsonResponse({"success": True})

@login_required
def voter_profile(request):
    try:
        voter = request.user.voter
    except Voter.DoesNotExist:
        return JsonResponse({"error": "Voter profile not found for user"}, status=404)

    return JsonResponse({
        "authenticated": True,
        "email": request.user.email,
        "roll": voter.student.roll,
        "name": voter.student.name,
        "is_voted": voter.is_voted,
        "is_verified": voter.is_verified,
    })

@login_required
def get_verified_voters(request):
    """
    Get all verified voters for blockchain account generation
    Frontend will auto-generate blockchain accounts for these voters
    """
    if not request.user.is_staff:
        return JsonResponse({"error": "Admin access required"}, status=403)
    
    # Get all verified voters
    voters = Voter.objects.filter(is_verified=True).select_related('student')
    
    voters_data = [{
        'id': v.id,
        'roll': v.student.roll,
        'email': v.student.email,
        'name': v.student.name,
        'is_verified': v.is_verified,
    } for v in voters]
    
    return JsonResponse({
        'voters': voters_data,
        'count': len(voters_data)
    })


@csrf_exempt
@login_required
def send_credentials_email(request):
    """
    Send blockchain credentials to a student via email
    Called from admin interface when sending individual credentials
    """
    if not request.user.is_staff:
        return JsonResponse({"error": "Admin access required"}, status=403)
    
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)
    
    data = json.loads(request.body)
    
    email = data.get('email')
    name = data.get('name')
    roll = data.get('roll')
    mnemonic = data.get('mnemonic')
    address = data.get('address')
    funded = data.get('funded', False)
    
    if not all([email, name, roll, mnemonic, address]):
        return JsonResponse({"error": "Missing required fields"}, status=400)
    
    # Email body
    email_body = f"""
Hello {name},

Your blockchain voting account has been created for the ChainBallot election system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STUDENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: {name}
Roll Number: {roll}
Email: {email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOCKCHAIN ACCOUNT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Blockchain Address:
{address}

Account Status: {'✅ FUNDED - Ready to vote' if funded else '⏳ PENDING FUNDING'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 SECRET RECOVERY PHRASE (12 WORDS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{mnemonic}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL SECURITY INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SAVE this 12-word phrase IMMEDIATELY in a secure location
2. NEVER share these words with anyone (including admins)
3. Anyone with this phrase can vote on your behalf
4. You will need this phrase to cast your vote
5. We will NEVER ask you for this phrase via email or phone
6. If you lose this phrase, you cannot vote - there is NO recovery

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO VOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When voting opens:
1. Go to the voting portal
2. Enter your 12-word recovery phrase
3. Select your candidates
4. Submit your vote to the blockchain

Your vote will be recorded permanently and anonymously on the blockchain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you have any questions, please contact the election administrators.

Best regards,
ChainBallot Election Team
    """
    
    try:
        send_mail(
            subject=f"ChainBallot Voting Credentials - {roll}",
            message=email_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Credentials sent to {email}'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def admin_login(request):
    """
    Admin login endpoint - checks if user is staff/superuser
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JsonResponse({"error": "Email and password required"}, status=400)

        # Authenticate user
        user = authenticate(request, username=email, password=password)

        if not user:
            return JsonResponse({"error": "Invalid credentials"}, status=401)

        # Check if user is staff or superuser
        if not (user.is_staff or user.is_superuser):
            return JsonResponse({"error": "Admin access required"}, status=403)

        # Login the user
        login(request, user)

        return JsonResponse({
            "success": True,
            "message": "Login successful",
            "user": {
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
def check_admin_auth(request):
    """
    Check if current session is authenticated as admin
    """
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"authenticated": False}, status=403)

    return JsonResponse({
        "authenticated": True,
        "user": {
            "email": request.user.email,
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser
        }
    })


@require_http_methods(["POST"])
def admin_logout(request):
    """
    Admin logout endpoint
    """
    logout(request)
    return JsonResponse({"success": True, "message": "Logged out successfully"})
