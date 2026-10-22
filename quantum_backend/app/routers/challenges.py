from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.security import require_configured_auth
from app.services.gamification_service import store
from app.services.repair_service import daily_challenge, evaluate_attempt, public_challenge
from app.schemas import RepairAttemptSubmission

router = APIRouter(prefix="/api/challenges", tags=["Challenges"])
game_router = APIRouter(prefix="/api/game", tags=["Challenges"])


@router.get("/repair/daily")
async def get_daily_repair_challenge(user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for repair challenges.")
    return {"success": True, **daily_challenge()}


@router.get("/repair/{challenge_id}")
async def get_repair_challenge(challenge_id: str, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for repair challenges.")
    try:
        return {"success": True, "challenge": public_challenge(challenge_id)}
    except KeyError as error:
        raise HTTPException(404, "Repair challenge not found.") from error


@game_router.post("/repair/{challenge_id}/attempt")
@router.post("/repair/{challenge_id}/attempt")
async def attempt_repair_challenge(challenge_id: str, payload: RepairAttemptSubmission, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for repair attempts.")
    try:
        result = evaluate_attempt(challenge_id, payload.operations)
        reward = await store.record_repair_attempt(user["id"], challenge_id, payload.operations, result, payload.hints_used)
        return {"success": True, "result": result, "reward": reward}
    except KeyError as error:
        raise HTTPException(404, "Repair challenge not found.") from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


class ChallengeProgressRequest(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=100)
    stage: int = Field(ge=0, le=20)
    circuit_data: dict[str, Any] = Field(default_factory=dict)
    completed: bool = False


async def _request(method: str, path: str, **kwargs):
    return await store._request(method, path, **kwargs)


@router.get("/{challenge_id}")
async def get_challenge_progress(challenge_id: str, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required to resume a challenge.")
    try:
        rows = await _request(
            "GET",
            f"saved_challenges?user_id=eq.{user['id']}&challenge_id=eq.{challenge_id}&select=challenge_id,stage,circuit_data,completed,updated_at",
        )
        return {"success": True, "progress": rows[0] if rows else None}
    except RuntimeError as error:
        raise HTTPException(503, "Challenge save storage is unavailable. Apply migration 17_notifications_and_challenges.sql.") from error


@router.put("/{challenge_id}")
async def save_challenge_progress(challenge_id: str, payload: ChallengeProgressRequest, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required to save a challenge.")
    if payload.challenge_id != challenge_id:
        raise HTTPException(400, "Challenge id does not match the requested resource.")
    try:
        rows = await _request(
            "POST",
            "saved_challenges?on_conflict=user_id,challenge_id",
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json={
                "user_id": user["id"],
                "challenge_id": challenge_id,
                "stage": payload.stage,
                "circuit_data": payload.circuit_data,
                "completed": payload.completed,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return {"success": True, "progress": rows[0] if rows else None}
    except RuntimeError as error:
        raise HTTPException(503, "Challenge save storage is unavailable. Apply migration 17_notifications_and_challenges.sql.") from error
