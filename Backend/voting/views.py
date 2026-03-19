import hashlib
import json
import os

from Crypto.Math.Numbers import Integer
from Crypto.PublicKey import RSA
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods

from voter.models import Voter
from voting.models import BlindSignature, Candidate, ElectionState


# KEY_PATH = os.path.join(settings.BASE_DIR, "private_key.pem")

# with open(KEY_PATH, "rb") as f:
#     private_key = RSA.import_key(f.read())


private_key_str = os.getenv("PRIVATE_KEY")

# Convert \n back to real newlines
private_key_str = private_key_str.replace("\\n", "\n")

private_key = RSA.import_key(private_key_str)


def _require_admin(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"error": "Admin access required"}, status=403)

    return None


def election_status(request):
    election = ElectionState.get_solo()
    return JsonResponse(
        {
            "status": election.status,
            "is_active": election.is_active,
            "started_at": election.started_at.isoformat() if election.started_at else None,
            "ended_at": election.ended_at.isoformat() if election.ended_at else None,
        }
    )


def list_candidates(request):
    candidates = Candidate.objects.filter(is_active=True).order_by("post", "name")
    posts = [choice[0] for choice in Candidate.POST_CHOICES]

    by_post = {post: [] for post in posts}
    for candidate in candidates:
        by_post[candidate.post].append(
            {
                "id": candidate.id,
                "candidate_id": candidate.candidate_id,
                "name": candidate.name,
                "post": candidate.post,
                "photo_url": candidate.photo_url,
            }
        )

    return JsonResponse({"posts": posts, "candidates": by_post})


@csrf_exempt
@login_required
@require_POST
def start_election(request):
    admin_error = _require_admin(request)
    if admin_error:
        return admin_error

    election = ElectionState.get_solo()
    if election.status == ElectionState.STATUS_ACTIVE:
        return JsonResponse({"error": "Election is already active"}, status=400)

    missing_posts = []
    for post, _ in Candidate.POST_CHOICES:
        if not Candidate.objects.filter(post=post, is_active=True).exists():
            missing_posts.append(post)

    if missing_posts:
        return JsonResponse(
            {
                "error": "Register candidates for all posts before starting election",
                "missing_posts": missing_posts,
            },
            status=400,
        )

    with transaction.atomic():
        Voter.objects.filter(is_verified=True).update(is_voted=False)
        BlindSignature.objects.all().delete()
        election.start()

    return JsonResponse(
        {
            "success": True,
            "message": "Election started successfully",
            "status": election.status,
            "started_at": election.started_at.isoformat() if election.started_at else None,
        }
    )


@csrf_exempt
@login_required
@require_POST
def end_election(request):
    admin_error = _require_admin(request)
    if admin_error:
        return admin_error

    election = ElectionState.get_solo()
    if election.status != ElectionState.STATUS_ACTIVE:
        return JsonResponse({"error": "Election is not active"}, status=400)

    election.end()

    return JsonResponse(
        {
            "success": True,
            "message": "Election ended successfully",
            "status": election.status,
            "ended_at": election.ended_at.isoformat() if election.ended_at else None,
        }
    )


@csrf_exempt
@login_required
@require_http_methods(["GET", "POST"])
def admin_candidates(request):
    admin_error = _require_admin(request)
    if admin_error:
        return admin_error

    if request.method == "GET":
        candidates = Candidate.objects.all().order_by("post", "name")
        return JsonResponse(
            {
                "candidates": [
                    {
                        "id": candidate.id,
                        "candidate_id": candidate.candidate_id,
                        "name": candidate.name,
                        "post": candidate.post,
                        "photo_url": candidate.photo_url,
                        "is_active": candidate.is_active,
                    }
                    for candidate in candidates
                ]
            }
        )

    election = ElectionState.get_solo()
    if election.status == ElectionState.STATUS_ACTIVE:
        return JsonResponse(
            {"error": "Cannot register candidates while election is active"},
            status=409,
        )

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    name = (data.get("name") or "").strip()
    post = (data.get("post") or "").strip()
    photo_url = (data.get("photo_url") or "").strip()
    candidate_id_raw = data.get("candidate_id")

    if not name or not post:
        return JsonResponse({"error": "name and post are required"}, status=400)

    # candidate_id must be provided and must be a positive integer
    if candidate_id_raw is None or str(candidate_id_raw).strip() == "":
        return JsonResponse({"error": "candidate_id is required"}, status=400)
    try:
        candidate_id = int(candidate_id_raw)
        if candidate_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({"error": "candidate_id must be a positive integer"}, status=400)

    if Candidate.objects.filter(candidate_id=candidate_id).exists():
        return JsonResponse({"error": "A candidate with this candidate_id already exists"}, status=409)

    allowed_posts = [choice[0] for choice in Candidate.POST_CHOICES]
    if post not in allowed_posts:
        return JsonResponse(
            {
                "error": "Invalid post",
                "allowed_posts": allowed_posts,
            },
            status=400,
        )

    candidate, created = Candidate.objects.get_or_create(
        name=name,
        post=post,
        defaults={"photo_url": photo_url, "candidate_id": candidate_id},
    )

    if not created:
        return JsonResponse(
            {"error": "Candidate already exists for this post"},
            status=409,
        )

    return JsonResponse(
        {
            "success": True,
            "candidate": {
                "id": candidate.id,
                "candidate_id": candidate.candidate_id,
                "name": candidate.name,
                "post": candidate.post,
                "photo_url": candidate.photo_url,
                "is_active": candidate.is_active,
            },
        },
        status=201,
    )


@csrf_exempt
@login_required
@require_POST
def delete_candidate(request, candidate_id):
    admin_error = _require_admin(request)
    if admin_error:
        return admin_error

    election = ElectionState.get_solo()
    if election.status == ElectionState.STATUS_ACTIVE:
        return JsonResponse(
            {"error": "Cannot remove candidates while election is active"},
            status=409,
        )

    try:
        candidate = Candidate.objects.get(id=candidate_id)
    except Candidate.DoesNotExist:
        return JsonResponse({"error": "Candidate not found"}, status=404)

    candidate.delete()
    return JsonResponse({"success": True, "message": "Candidate removed"})


@csrf_exempt
@login_required
@require_POST
def sign_blind_vote(request):
    try:
        voter = request.user.voter
    except Voter.DoesNotExist:
        return JsonResponse(
            {"error": "User is not registered as voter"},
            status=403,
        )

    election = ElectionState.get_solo()
    if election.status == ElectionState.STATUS_NOT_STARTED:
        return JsonResponse({"error": "Election has not started yet"}, status=403)

    if election.status == ElectionState.STATUS_ENDED:
        return JsonResponse({"error": "Election has already ended"}, status=403)

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
                status=409,
            )

        signed_blinded = pow(blinded, private_key.d, private_key.n)

        BlindSignature.objects.create(voter=voter, blinded_hash=blinded_hash)

        voter.is_voted = True
        voter.save(update_fields=["is_voted"])

    return JsonResponse({"signedBlinded": hex(signed_blinded)[2:]})
