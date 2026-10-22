import asyncio
import re
from pathlib import Path
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.gamification import _matches_mission
from app.security import require_configured_auth
from app.schemas import CircuitMissionSubmission
from app.services.gamification_service import (
    XP_REWARD_RULES,
    effective_streak,
    level_for_xp,
    store,
    validate_reward_source,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(require_configured_auth, None)


def test_circuit_mission_validation_requires_the_learning_objective():
    superposition = CircuitMissionSubmission(qubits=1, operations=[{"gate": "H", "target": 0, "col": 0}])
    incomplete_bell = CircuitMissionSubmission(qubits=2, operations=[{"gate": "H", "target": 0, "col": 0}])
    noisy_superposition = CircuitMissionSubmission(qubits=1, operations=[{"gate": "H", "target": 0, "col": 0}, {"gate": "X", "target": 0, "col": 1}])
    reversed_bell = CircuitMissionSubmission(qubits=2, operations=[
        {"gate": "CNOT", "control": 0, "target": 1, "col": 0},
        {"gate": "H", "target": 0, "col": 1},
    ])
    bell = CircuitMissionSubmission(qubits=2, operations=[
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
    ])
    ghz = CircuitMissionSubmission(qubits=3, operations=[
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
        {"gate": "CNOT", "control": 0, "target": 2, "col": 2},
    ])
    incomplete_ghz = CircuitMissionSubmission(qubits=3, operations=[
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
    ])
    assert _matches_mission("build-superposition", superposition)
    assert not _matches_mission("build-superposition", noisy_superposition)
    assert not _matches_mission("build-bell-state", incomplete_bell)
    assert not _matches_mission("build-bell-state", reversed_bell)
    assert _matches_mission("build-bell-state", bell)
    assert _matches_mission("build-ghz-state", ghz)
    assert not _matches_mission("build-ghz-state", incomplete_ghz)


def test_level_progress_uses_the_documented_formula():
    assert level_for_xp(100)["number"] == 2
    assert level_for_xp(100)["name"] == "Qubit Explorer"
    assert level_for_xp(100)["progress_percent"] == 0


def test_level_thresholds_and_progress_are_consistent():
    assert level_for_xp(0)["number"] == 1
    assert level_for_xp(398)["progress_percent"] == 99
    assert level_for_xp(400)["number"] == 3
    assert level_for_xp(400)["progress_percent"] == 0


@pytest.mark.parametrize(
    ("last_activity_date", "expected"),
    [
        ("2026-10-22", 7),
        ("2026-10-21", 7),
        ("2026-10-20", 0),
        (None, 0),
    ],
)
def test_streak_is_active_only_through_the_following_utc_day(last_activity_date, expected):
    assert effective_streak(7, last_activity_date, date(2026, 10, 22)) == expected


def test_xp_sources_have_server_owned_fixed_values():
    assert XP_REWARD_RULES == {
        "lesson_checkpoint": 10,
        "quiz_pass": 20,
        "challenge_solve": 30,
        "circuit_challenge": 50,
        "mastery_assessment": 75,
        "major_milestone": 100,
        "topic_complete": 15,
        "module_complete": 100,
        "puzzle_solve": 25,
        "lab_experiment": 20,
        "contest_solution": 75,
    }
    assert validate_reward_source("circuit_mission", "build-superposition") == 30
    assert validate_reward_source("circuit_mission", "build-ghz-state") == 60
    assert validate_reward_source(
        "contest_solution",
        "contest:11111111-1111-1111-1111-111111111111:problem:22222222-2222-2222-2222-222222222222",
    ) == 75


@pytest.mark.parametrize(
    ("source_type", "source_id"),
    [
        ("unknown_source", "activity"),
        ("circuit_mission", "invented-mission"),
        ("contest_solution", "invented-contest-key"),
        ("lesson_checkpoint", ""),
    ],
)
def test_unknown_or_invalid_xp_sources_are_rejected(source_type, source_id):
    with pytest.raises(ValueError):
        validate_reward_source(source_type, source_id)


def test_unknown_reward_is_rejected_before_database_request():
    with pytest.raises(ValueError, match="Unknown XP source type"):
        asyncio.run(store.award("learner-id", "unrecognized", "some-event"))


def test_gamification_api_rejects_missing_authentication(client):
    app.dependency_overrides[require_configured_auth] = lambda: None
    response = client.get("/api/gamification/summary")
    assert response.status_code == 401


def test_gamification_summary_uses_authenticated_identity_not_query_user(monkeypatch, client):
    app.dependency_overrides[require_configured_auth] = lambda: {"id": "authenticated-learner"}
    requested_users = []

    async def fake_summary(user_id):
        requested_users.append(user_id)
        return {"total_xp": 0}

    monkeypatch.setattr(store, "summary", fake_summary)
    response = client.get("/api/gamification/summary?user_id=another-learner")

    assert response.status_code == 200
    assert requested_users == ["authenticated-learner"]


def test_mission_catalog_is_bound_to_authenticated_learner(monkeypatch, client):
    app.dependency_overrides[require_configured_auth] = lambda: {"id": "authenticated-learner"}
    requested_users = []

    async def fake_catalog(user_id):
        requested_users.append(user_id)
        return [{"id": "foundations", "missions": []}]

    monkeypatch.setattr(store, "mission_catalog", fake_catalog)
    response = client.get("/api/gamification/missions?user_id=another-learner")

    assert response.status_code == 200
    assert response.json()["sectors"][0]["id"] == "foundations"
    assert requested_users == ["authenticated-learner"]


def test_mission_catalog_groups_ordered_steps_and_reads_completion_events(monkeypatch):
    requests = []

    async def fake_request(method, path, **kwargs):
        requests.append(path)
        if path.startswith("game_sectors?"):
            return [{"id": "foundations", "title": "Foundations", "description": "Start here.", "order_index": 1}]
        if path.startswith("game_missions?"):
            return [{
                "id": "build-superposition",
                "sector_id": "foundations",
                "sequence": 1,
                "title": "Create a superposition",
                "description": "Build H on q0.",
                "mission_type": "circuit",
                "route": "/circuit?mission=build-superposition",
                "reward_source_type": "circuit_mission",
                "reward_source_id": "build-superposition",
                "progress_module_id": None,
                "required": True,
            }]
        if path.startswith("game_mission_steps?"):
            return [{
                "mission_id": "build-superposition",
                "sequence": 1,
                "title": "Build the circuit",
                "description": "Apply H.",
                "route": "/circuit?mission=build-superposition",
            }]
        if path.startswith("xp_events?"):
            return [{"source_type": "circuit_mission", "source_id": "build-superposition"}]
        if path.startswith("module_progress?"):
            return []
        raise AssertionError(f"Unexpected request: {path}")

    monkeypatch.setattr(store, "_request", fake_request)
    catalog = asyncio.run(store.mission_catalog("learner-1"))

    mission = catalog[0]["missions"][0]
    assert mission["status"] == "completed"
    assert mission["steps"][0]["title"] == "Build the circuit"
    assert requests[0].startswith("game_sectors?")
    assert requests[-1].startswith("xp_events?user_id=eq.learner-1")


def test_lesson_mission_completion_uses_module_progress_without_awarding_xp(monkeypatch):
    requests = []

    async def fake_request(method, path, **kwargs):
        requests.append(path)
        if path.startswith("game_sectors?"):
            return [{"id": "foundations", "title": "Foundations", "description": "Start here.", "order_index": 1}]
        if path.startswith("game_missions?"):
            return [{
                "id": "module-foundations",
                "sector_id": "foundations",
                "sequence": 1,
                "title": "Study the foundations",
                "description": "Learn the basics.",
                "mission_type": "lesson",
                "route": "/modules/1",
                "reward_source_type": None,
                "reward_source_id": None,
                "progress_module_id": 1,
                "required": True,
            }]
        if path.startswith("game_mission_steps?"):
            return []
        if path.startswith("xp_events?"):
            return []
        if path.startswith("module_progress?"):
            return [{"module_id": 1}]
        raise AssertionError(f"Unexpected request: {path}")

    monkeypatch.setattr(store, "_request", fake_request)
    catalog = asyncio.run(store.mission_catalog("learner-1"))

    assert catalog[0]["missions"][0]["status"] == "completed"
    assert any("module_progress?user_id=eq.learner-1&module_id=in.(1)" in path for path in requests)
    assert not any("award" in path.lower() for path in requests)


def test_mission_reward_is_bound_to_authenticated_learner(monkeypatch, client):
    app.dependency_overrides[require_configured_auth] = lambda: {"id": "authenticated-learner"}
    rewarded = []

    async def fake_award(user_id, source_type, source_id):
        rewarded.append((user_id, source_type, source_id))
        return {"awarded": True, "xp_awarded": 30}

    monkeypatch.setattr(store, "award", fake_award)
    response = client.post(
        "/api/gamification/circuit-missions/build-superposition/submit",
        json={"qubits": 1, "operations": [{"gate": "H", "target": 0, "col": 0}]},
    )

    assert response.status_code == 200
    assert rewarded == [("authenticated-learner", "circuit_mission", "build-superposition")]


def test_migration_enforces_server_only_writes_and_idempotent_events():
    migration = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20_server_validated_xp_events.sql"
    sql = migration.read_text(encoding="utf-8")
    profile_rls = migration.parent / "02_rls_policies.sql"
    profile_sql = profile_rls.read_text(encoding="utf-8")
    assert "ALTER TABLE public.gamification_rewards RENAME TO xp_events" in sql
    assert "REVOKE ALL ON TABLE public.xp_events FROM PUBLIC, anon, authenticated" in sql
    assert "GRANT ALL ON TABLE public.xp_events TO service_role" in sql
    assert "REVOKE UPDATE ON public.profiles FROM authenticated, anon, public" in profile_sql
    assert "ON CONFLICT (user_id, source_type, source_id) DO NOTHING" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_user_source" in sql
    assert "IF reward_xp IS NULL THEN" in sql
    assert "RAISE EXCEPTION 'Unknown or invalid XP source'" in sql
    assert "COALESCE(auth.role(), '') <> 'service_role'" in sql
    assert "GRANT EXECUTE ON FUNCTION public._record_verified_xp" not in sql
    assert "GRANT EXECUTE ON FUNCTION public._unlock_gamification_achievement" not in sql


def test_repair_badges_and_week_warrior_are_server_unlocked():
    migration = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20_server_validated_xp_events.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "event_count >= 5" in sql
    assert "earned_badges := array_append(earned_badges, 'circuit_builder')" in sql
    assert "active_streak >= 7" in sql
    assert "earned_badges := array_append(earned_badges, 'streak_7')" in sql
    assert "earned_badges := array_append(earned_badges, 'first-repair')" in sql
    assert "earned_badges := array_append(earned_badges, 'clean-repair')" in sql


def test_ai_tutor_quota_migration_is_server_only_and_atomic():
    migration = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "21_ai_tutor_quotas.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "PRIMARY KEY (user_id, usage_date)" in sql
    assert "Only the service role may consume AI Tutor quota" in sql
    assert "REVOKE ALL ON TABLE public.ai_tutor_usage FROM PUBLIC, anon, authenticated" in sql
    assert "GRANT EXECUTE ON FUNCTION public.consume_ai_tutor_quota" in sql
    assert "ON CONFLICT (user_id, usage_date) DO UPDATE" in sql


def test_ordered_missions_are_persisted_and_read_only_to_authenticated_users():
    migration = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "22_ordered_game_missions.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.game_sectors" in sql
    assert "UNIQUE (sector_id, sequence)" in sql
    assert "CREATE TABLE IF NOT EXISTS public.game_mission_steps" in sql
    assert "FOR SELECT TO authenticated USING (published)" in sql
    assert "REVOKE ALL ON TABLE public.game_sectors, public.game_missions, public.game_mission_steps" in sql
    assert "INSERT INTO public.game_missions" in sql
    assert "'module-foundations'" in sql and "'module-entanglement'" in sql


def test_browser_never_writes_xp_or_achievement_ledgers():
    src_root = Path(__file__).resolve().parents[2] / "src"
    forbidden_write = re.compile(
        r"\.from\(\s*['\"](?:xp_events|gamification_rewards|gamification_achievements)['\"]\s*\)"
        r"\s*\.\s*(?:insert|upsert|update|delete)\s*\(",
        re.IGNORECASE,
    )
    violations = []
    for source in src_root.rglob("*"):
        if source.suffix in {".js", ".jsx", ".ts", ".tsx"}:
            if forbidden_write.search(source.read_text(encoding="utf-8")):
                violations.append(str(source))
    assert violations == []
