from datetime import date

from app.services.repair_service import daily_challenge, evaluate_attempt, public_challenge


def test_repair_accepts_correct_phase_sensitive_solution():
    result = evaluate_attempt("repair-hadamard-phase", [{"gate": "X", "target": 0, "col": 0}, {"gate": "H", "target": 0, "col": 1}])
    assert result["passed"] is True
    assert result["fidelity"] == 1.0


def test_repair_rejects_same_histogram_but_wrong_phase():
    # H|0> and H|1> both measure 50/50, but are orthogonal |+> and |−> states.
    result = evaluate_attempt("repair-hadamard-phase", [{"gate": "H", "target": 0, "col": 0}])
    assert result["passed"] is False
    assert result["fidelity"] == 0.0


def test_public_challenge_never_leaks_solution_operations():
    challenge = public_challenge("repair-bell-link")
    assert "correct_ops" not in challenge
    assert challenge["target_probabilities"] == {"00": 0.5, "11": 0.5}


def test_daily_repair_challenge_is_deterministic_and_keeps_solution_private():
    day = date(2026, 10, 22)
    first = daily_challenge(day)
    second = daily_challenge(day)

    assert first == second
    assert first["date"] == day.isoformat()
    assert "correct_ops" not in first["challenge"]
