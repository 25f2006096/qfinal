import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.services.contest_service import contest_status, ops_to_qiskit, score_submission, store
from app.schemas import ContestSubmissionRequest


def bell_problem():
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "contest_id": "22222222-2222-2222-2222-222222222222",
        "contest_type": "circuit_building",
        "qubit_budget": 2,
        "gate_budget": 2,
        "par_gates": 2,
        "par_depth": 2,
        "reference_ops": [
            {"gate": "H", "target": 0, "col": 0},
            {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
        ],
        "pass_threshold": 0.95,
    }


def test_circuit_submission_uses_existing_qiskit_compiler_and_scores_bell_pair(monkeypatch):
    problem = bell_problem()
    monkeypatch.setattr(settings, "ibm_quantum_api_key", None)
    monkeypatch.setattr(settings, "ibm_quantum_instance", None)

    async def no_previous_submissions(problem_id, user_id):
        return []

    async def save_submission(submission):
        return submission

    monkeypatch.setattr(store, "submissions", no_previous_submissions)
    monkeypatch.setattr(store, "add_submission", save_submission)
    request = ContestSubmissionRequest(submission_type="ops", ops=[
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
    ])
    submission = asyncio.run(score_submission(problem, "local-user", request))
    # Scores are sampled from the existing simulator, so a Bell distribution
    # is expected to be near-perfect rather than bit-for-bit deterministic.
    assert submission["correctness_score"] >= .95
    assert submission["efficiency_score"] == pytest.approx(1)
    assert submission["total_score"] == pytest.approx(1.0)


def test_contest_leaderboard_scopes_submissions_and_resolves_participant_names(monkeypatch):
    problem_id = "11111111-1111-1111-1111-111111111111"
    user_id = "33333333-3333-3333-3333-333333333333"
    requests = []

    async def fake_request(method, path, **kwargs):
        requests.append(path)
        if path.startswith("contest_submissions"):
            return [{
                "user_id": user_id,
                "problem_id": problem_id,
                "total_score": 0.9,
                "correctness_score": 0.95,
                "is_best_for_user": True,
            }]
        if path.startswith("profiles?"):
            return [{"id": user_id, "full_name": "Ada Learner"}]
        raise AssertionError(f"Unexpected request path: {path}")

    async def get_problems(contest_id, private=False):
        return [{"id": problem_id}]

    monkeypatch.setattr(store, "problems", get_problems)
    monkeypatch.setattr(store, "_request", fake_request)

    result = asyncio.run(store.leaderboard("22222222-2222-2222-2222-222222222222"))

    assert result[0]["display_name"] == "Ada Learner"
    assert problem_id in requests[0]
    assert "limit=500" in requests[0]
    assert requests[1] == f"profiles?id=in.({user_id})&select=id,full_name"


def test_ops_converter_rejects_unknown_gate_before_compilation():
    with pytest.raises(ValueError, match="Unsupported contest gate"):
        ops_to_qiskit([{"gate": "evil", "target": 0, "col": 0}], 1)


def test_contest_status_uses_persisted_schedule():
    now = datetime.now(timezone.utc)
    assert contest_status({"start_time": (now - timedelta(minutes=1)).isoformat(), "end_time": (now + timedelta(minutes=1)).isoformat()}) == "live"
    assert contest_status({"start_time": (now + timedelta(minutes=1)).isoformat(), "end_time": (now + timedelta(minutes=2)).isoformat()}) == "upcoming"
    assert contest_status({"start_time": (now - timedelta(minutes=2)).isoformat(), "end_time": (now - timedelta(minutes=1)).isoformat()}) == "ended"
