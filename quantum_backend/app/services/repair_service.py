"""Authoritative Repair Circuit evaluation.

Challenge solutions stay in this backend-only module.  The browser receives an
id, briefing and target probabilities from a separate catalogue, never
``correct_ops``.  Fidelity is evaluated on state vectors so a Z/phase fault
cannot pass merely because its measurement histogram happens to match.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, state_fidelity

_ALLOWED = {"H", "X", "Y", "Z", "S", "T", "Rx", "Ry", "Rz", "CNOT", "CZ", "SWAP"}

# Intentionally private: do not import this object into a route response.
_CHALLENGES: dict[str, dict[str, Any]] = {
    "repair-hadamard-phase": {
        "title": "Restore the phase calibrator", "tier": 1, "qubits": 1,
        "briefing": "The calibrator must prepare the |−⟩ state. Repair its gate sequence.",
        "correct_ops": [{"gate": "X", "target": 0, "col": 0}, {"gate": "H", "target": 0, "col": 1}],
        "pass_threshold": 0.999,
    },
    "repair-bell-link": {
        "title": "Restore the entanglement link", "tier": 2, "qubits": 2,
        "briefing": "Rebuild a Bell-pair link between q0 and q1.",
        "correct_ops": [{"gate": "H", "target": 0, "col": 0}, {"gate": "CNOT", "control": 0, "target": 1, "col": 1}],
        "pass_threshold": 0.999,
    },
}


def public_challenge(challenge_id: str) -> dict[str, Any]:
    challenge = _CHALLENGES.get(challenge_id)
    if not challenge:
        raise KeyError(challenge_id)
    target = _state_for(challenge["qubits"], challenge["correct_ops"])
    return {
        "id": challenge_id, "title": challenge["title"], "tier": challenge["tier"],
        "qubits": challenge["qubits"], "briefing": challenge["briefing"],
        "pass_threshold": challenge["pass_threshold"],
        "target_probabilities": _probabilities(target),
    }


def daily_challenge(for_date: date | None = None) -> dict[str, Any]:
    day = for_date or datetime.now(timezone.utc).date()
    challenge_ids = sorted(_CHALLENGES)
    challenge_id = challenge_ids[day.toordinal() % len(challenge_ids)]
    return {"date": day.isoformat(), "challenge": public_challenge(challenge_id)}


def evaluate_attempt(challenge_id: str, operations: list[dict[str, Any]]) -> dict[str, Any]:
    challenge = _CHALLENGES.get(challenge_id)
    if not challenge:
        raise KeyError(challenge_id)
    submitted = _state_for(challenge["qubits"], operations)
    expected = _state_for(challenge["qubits"], challenge["correct_ops"])
    fidelity = float(state_fidelity(expected, submitted))
    passed = fidelity >= challenge["pass_threshold"]
    return {
        "passed": passed, "fidelity": round(fidelity, 6),
        "threshold": challenge["pass_threshold"],
        "probabilities": _probabilities(submitted),
        "feedback": "System restored." if passed else "The state is not yet aligned with the target. Check gate order and phase.",
    }


def _state_for(qubits: int, operations: list[dict[str, Any]]) -> Statevector:
    circuit = QuantumCircuit(qubits)
    for op in sorted(operations, key=lambda item: int(item.get("col", 0))):
        gate, target = op.get("gate"), op.get("target")
        if gate not in _ALLOWED or not isinstance(target, int) or not 0 <= target < qubits:
            raise ValueError("Unsupported gate or target qubit.")
        control = op.get("control")
        if gate in {"CNOT", "CZ", "SWAP"}:
            if not isinstance(control, int) or not 0 <= control < qubits or control == target:
                raise ValueError("Two-qubit gates require different valid control and target qubits.")
            {"CNOT": circuit.cx, "CZ": circuit.cz, "SWAP": circuit.swap}[gate](control, target)
        elif gate in {"Rx", "Ry", "Rz"}:
            angle = op.get("angle")
            if not isinstance(angle, (int, float)):
                raise ValueError("Rotation gates require a numeric angle.")
            {"Rx": circuit.rx, "Ry": circuit.ry, "Rz": circuit.rz}[gate](angle, target)
        else:
            getattr(circuit, gate.lower())(target)
    return Statevector.from_instruction(circuit)


def _probabilities(state: Statevector) -> dict[str, float]:
    qubits = int((len(state.data)).bit_length() - 1)
    return {format(index, f"0{qubits}b"): round(float(value), 6) for index, value in enumerate(state.probabilities()) if value > 1e-9}
