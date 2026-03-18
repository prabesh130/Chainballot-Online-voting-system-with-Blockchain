from django.urls import path
from .views import (
    admin_candidates,
    delete_candidate,
    election_status,
    end_election,
    list_candidates,
    sign_blind_vote,
    start_election,
)

urlpatterns = [
    path("api/sign-blind-vote/", sign_blind_vote),
    path("election/status/", election_status),
    path("election/candidates/", list_candidates),
    path("admin/election/start/", start_election),
    path("admin/election/end/", end_election),
    path("admin/candidates/", admin_candidates),
    path("admin/candidates/<int:candidate_id>/delete/", delete_candidate),
]
