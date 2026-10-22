from fastapi.testclient import TestClient

from app.main import app
from app.routers import challenges
from app.security import require_configured_auth


def test_challenge_progress_requires_authentication_in_production(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_anon_key", None)
    response = TestClient(app).get("/api/challenges/entanglement-guardian")
    assert response.status_code == 503
    assert "Authentication is not configured" in response.json()["detail"]


def test_challenge_progress_reports_missing_storage_in_development(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_anon_key", None)
    response = TestClient(app).get("/api/challenges/entanglement-guardian")
    assert response.status_code == 401


def test_repair_route_aliases_use_the_same_authenticated_scorer(monkeypatch):
    monkeypatch.setitem(app.dependency_overrides, require_configured_auth, lambda: {"id": "learner-1"})
    evaluated = []
    rewarded = []

    def fake_evaluate(challenge_id, operations):
        evaluated.append((challenge_id, operations))
        return {"passed": True, "fidelity": 1.0}

    async def fake_record(user_id, challenge_id, operations, result, hints_used):
        rewarded.append((user_id, challenge_id, hints_used))
        return {"awarded": True, "xp_awarded": 20}

    monkeypatch.setattr(challenges, "evaluate_attempt", fake_evaluate)
    monkeypatch.setattr(challenges.store, "record_repair_attempt", fake_record)
    payload = {"operations": [{"gate": "X", "target": 0, "col": 0}], "hints_used": 1}

    with TestClient(app) as client:
        legacy_response = client.post("/api/challenges/repair/repair-hadamard-phase/attempt", json=payload)
        alias_response = client.post("/api/game/repair/repair-hadamard-phase/attempt", json=payload)

    assert legacy_response.status_code == alias_response.status_code == 200
    assert legacy_response.json() == alias_response.json()
    assert evaluated == [
        ("repair-hadamard-phase", payload["operations"]),
        ("repair-hadamard-phase", payload["operations"]),
    ]
    assert rewarded == [("learner-1", "repair-hadamard-phase", 1)] * 2


def test_daily_repair_endpoint_requires_authentication(monkeypatch):
    from fastapi.testclient import TestClient
    from app.config import settings

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_anon_key", None)
    response = TestClient(app).get("/api/challenges/repair/daily")
    assert response.status_code == 503