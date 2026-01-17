# views.py
import os
import json
import hashlib

from django.http import JsonResponse
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from Crypto.PublicKey import RSA
from Crypto.Math.Numbers import Integer

from voter.models import Voter
from voting.models import BlindSignature   # see model below


# 🔐 Load RSA private key (once, at startup)
KEY_PATH = os.path.join(settings.BASE_DIR, "private_key.pem")

with open(KEY_PATH, "rb") as f:
    private_key = RSA.import_key(f.read())

@csrf_exempt
@login_required
@require_POST
def sign_blind_vote(request):
    print("AUTH:", request.user.is_authenticated)
    print("USER:", request.user)

    try:
        voter = request.user.voter
        print("VOTER FOUND:", voter.id)
        print("is_verified:", voter.is_verified)
        print("is_voted:", voter.is_voted)
    except Voter.DoesNotExist:
        print("NO VOTER OBJECT")
        return JsonResponse(
            {"error": "User is not registered as voter"},
            status=403
        )
    
    try:
        voter = request.user.voter
    except Voter.DoesNotExist:
        return JsonResponse(
            {"error": "User is not registered as voter"},
            status=403
        )

    if not voter.is_verified:
        return JsonResponse({"error": "Voter not verified"}, status=403)

    if voter.is_voted:
        return JsonResponse({"error": "You have already voted"}, status=403)

    try:
        body = json.loads(request.body)
        blinded_hex = body.get("blindedVote")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not blinded_hex:
        return JsonResponse({"error": "blindedVote missing"}, status=400)

    try:
        blinded = Integer(int(blinded_hex, 16))
    except ValueError:
        return JsonResponse({"error": "Invalid blindedVote"}, status=400)

    if blinded <= 0 or blinded >= private_key.n:
        return JsonResponse({"error": "Invalid blinded vote"}, status=400)

    blinded_hash = hashlib.sha256(blinded_hex.encode()).hexdigest()

    with transaction.atomic():
        voter.refresh_from_db()

        if voter.is_voted:
            return JsonResponse({"error": "You have already voted"}, status=403)

        if BlindSignature.objects.filter(voter=voter).exists():
            return JsonResponse(
                {"error": "Blind signature already issued"},
                status=409
            )

        signed_blinded = pow(blinded, private_key.d, private_key.n)

        BlindSignature.objects.create(
            voter=voter,
            blinded_hash=blinded_hash
        )

        voter.is_voted = True
        voter.save(update_fields=["is_voted"])

    return JsonResponse({
        "signedBlinded": hex(signed_blinded)[2:]
    })
