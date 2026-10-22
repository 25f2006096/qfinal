"""Server-side, idempotent reward persistence for verified learning events."""
from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.config import settings


MISSIONS: dict[str, dict[str, Any]] = {
    "build-superposition": {
        "title": "Create a superposition",
        "description": "Apply a Hadamard gate to q0 and simulate the circuit.",
        "xp_reward": 30,
        "estimated_minutes": 5,
        "route": "/circuit?mission=build-superposition",
    },
    "build-bell-state": {
        "title": "Build a Bell state",
        "description": "Entangle q0 and q1 with H followed by CNOT, then simulate it.",
        "xp_reward": 50,
        "estimated_minutes": 10,
        "route": "/circuit?mission=build-bell-state",
    },
    "build-ghz-state": {
        "title": "Assemble a 3-qubit GHZ state",
        "description": "Entangle q0, q1, and q2 into 1/√2(|000⟩ + |111⟩) with H followed by two CNOTs.",
        "xp_reward": 60,
        "estimated_minutes": 15,
        "route": "/circuit?mission=build-ghz-state",
    },
}

RANKS = (
    "Quantum Initiate",
    "Qubit Explorer",
    "Superposition Specialist",
    "Quantum Gate Engineer",
    "Entanglement Researcher",
    "Circuit Architect",
    "Quantum Algorithm Master",
    "Quantum Pioneer",
)

XP_REWARD_RULES: dict[str, int] = {
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


def validate_reward_source(source_type: str, source_id: str) -> int:
    """Resolve only recognized reward sources to server-owned XP values."""
    if not isinstance(source_type, str) or not isinstance(source_id, str) or not source_id.strip() or len(source_id) > 200:
        raise ValueError("A known XP source and a non-empty source ID are required.")
    if source_type == "circuit_mission":
        mission = MISSIONS.get(source_id)
        if mission is None:
            raise ValueError("Unknown circuit mission XP source.")
        return int(mission["xp_reward"])
    if source_type == "contest_solution":
        import re
        uuid_pattern = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        if not re.fullmatch(rf"contest:{uuid_pattern}:problem:{uuid_pattern}", source_id):
            raise ValueError("Unknown contest XP source.")
        return XP_REWARD_RULES[source_type]
    if source_type not in XP_REWARD_RULES:
        raise ValueError("Unknown XP source type.")
    return XP_REWARD_RULES[source_type]


def level_for_xp(total_xp: int) -> dict[str, Any]:
    number = math.floor(math.sqrt(max(0, total_xp) / 100)) + 1
    current_floor = (number - 1) ** 2 * 100
    next_threshold = number ** 2 * 100
    return {
        "number": number,
        "name": RANKS[min(number - 1, len(RANKS) - 1)],
        "label": f"Level {number}",
        "progress_percent": min(100, round((total_xp - current_floor) / (next_threshold - current_floor) * 100)),
        "next_threshold": next_threshold,
    }


def effective_streak(current_streak: int, last_activity_date: str | date | None, today: date | None = None) -> int:
    if last_activity_date is None:
        return 0
    if isinstance(last_activity_date, str):
        try:
            last_activity_date = date.fromisoformat(last_activity_date[:10])
        except ValueError:
            return 0
    today = today or datetime.now(timezone.utc).date()
    return current_streak if 0 <= (today - last_activity_date).days <= 1 else 0


class GamificationStore:
    def _headers(self) -> dict[str, str]:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Gamification storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.")
        key = settings.supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async def _request(self, method: str, path: str, **kwargs):
        headers = self._headers()
        headers.update(kwargs.pop("headers", {}))
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}", headers=headers, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError("Gamification storage request failed.")
        return response.json() if response.content else None

    async def summary(self, user_id: str) -> dict[str, Any]:
        profiles = await self._request(
            "GET",
            f"profiles?id=eq.{user_id}&select=total_xp,current_streak,longest_streak,last_gamification_activity_date",
        )
        profile = profiles[0] if profiles else {}
        completed = await self._request("GET", f"xp_events?user_id=eq.{user_id}&select=source_id,source_type,created_at")
        completed_keys = {row["source_id"] for row in completed or []}
        achievements = await self._request("GET", f"gamification_achievements?user_id=eq.{user_id}&select=achievement_id,unlocked_at&order=unlocked_at.desc")
        missions = [
            {"id": mission_id, **mission, "status": "completed" if mission_id in completed_keys else "available"}
            for mission_id, mission in MISSIONS.items()
        ]
        total_xp = int(profile.get("total_xp") or 0)
        return {
            "total_xp": total_xp,
            "current_streak": effective_streak(
                int(profile.get("current_streak") or 0),
                profile.get("last_gamification_activity_date"),
            ),
            "longest_streak": int(profile.get("longest_streak") or 0),
            "level": level_for_xp(total_xp),
            "missions": missions,
            "next_mission": next((mission for mission in missions if mission["status"] != "completed"), None),
            "achievements": [
                ACHIEVEMENTS[row["achievement_id"]] | {
                    "id": row["achievement_id"],
                    "unlocked_at": row["unlocked_at"],
                    "description": ACHIEVEMENTS[row["achievement_id"]]["desc"],
                }
                for row in achievements or [] if row["achievement_id"] in ACHIEVEMENTS
            ],
            "daily_quests": self._daily_quests(completed or []),
            "weekly_quests": self._weekly_quests(completed or []),
            "reward_history": self._reward_history(completed or []),
        }

    async def mission_catalog(self, user_id: str) -> list[dict[str, Any]]:
        sectors = await self._request(
            "GET",
            "game_sectors?published=eq.true&select=id,title,description,order_index&order=order_index.asc",
        )
        missions = await self._request(
            "GET",
            "game_missions?published=eq.true&select=id,sector_id,sequence,title,description,mission_type,route,reward_source_type,reward_source_id,required,progress_module_id&order=sector_id.asc,sequence.asc",
        )
        if not missions:
            return [
                {"id": sector["id"], "title": sector["title"], "description": sector["description"], "missions": []}
                for sector in sectors or []
            ]
        mission_ids = ",".join(row["id"] for row in missions)
        steps = await self._request(
            "GET",
            f"game_mission_steps?mission_id=in.({mission_ids})&select=mission_id,sequence,title,description,route&order=sequence.asc",
        )
        events = await self._request(
            "GET",
            f"xp_events?user_id=eq.{user_id}&source_type=in.(circuit_mission,repair_circuit)&select=source_type,source_id",
        )
        lesson_module_ids = {
            row["progress_module_id"]
            for row in missions
            if row["mission_type"] == "lesson" and row.get("progress_module_id") is not None
        }
        completed_modules: set[int] = set()
        if lesson_module_ids:
            module_filter = ",".join(str(module_id) for module_id in sorted(lesson_module_ids))
            module_progress = await self._request(
                "GET",
                f"module_progress?user_id=eq.{user_id}&module_id=in.({module_filter})&select=module_id",
            )
            completed_modules = {row["module_id"] for row in module_progress or []}
        completed = {
            (event["source_type"], event["source_id"])
            for event in events or []
        }
        steps_by_mission: dict[str, list[dict[str, Any]]] = {}
        for step in steps or []:
            steps_by_mission.setdefault(step["mission_id"], []).append({
                "sequence": step["sequence"],
                "title": step["title"],
                "description": step["description"],
                "route": step["route"],
            })
        missions_by_sector: dict[str, list[dict[str, Any]]] = {}
        for mission in missions:
            reward_source = (mission.get("reward_source_type"), mission.get("reward_source_id"))
            if mission["mission_type"] == "lesson":
                done = mission.get("progress_module_id") in completed_modules
            elif mission["mission_type"] == "repair":
                done = any(
                    kind == "repair_circuit" and source_id.startswith("repair:")
                    for kind, source_id in completed
                )
            else:
                done = reward_source in completed if reward_source[0] else False
            missions_by_sector.setdefault(mission["sector_id"], []).append({
                "id": mission["id"],
                "sequence": mission["sequence"],
                "title": mission["title"],
                "description": mission["description"],
                "type": mission["mission_type"],
                "route": mission["route"],
                "required": mission["required"],
                "status": "completed" if done else "available",
                "steps": steps_by_mission.get(mission["id"], []),
            })
        return [
            {
                "id": sector["id"],
                "title": sector["title"],
                "description": sector["description"],
                "missions": missions_by_sector.get(sector["id"], []),
            }
            for sector in sectors or []
        ]

    async def weekly_leaderboard(self, user_id: str) -> dict[str, Any]:
        """Return only the privacy-safe fields produced by the server-side RPC.

        Aggregation is deliberately performed in Postgres rather than in the
        browser so clients cannot choose their own XP totals or rank.
        """
        rows = await self._request("POST", "rpc/learning_weekly_leaderboard", json={"p_viewer_id": user_id})
        rows = rows or []
        return {"metric": "verified XP earned this UTC week", "period": "week", "entries": rows[:20]}

    @staticmethod
    def _daily_quests(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        today_keys = {row["source_id"] for row in rewards if str(row.get("created_at", "")).startswith(today)}
        return [{
            "id": "daily-circuit", "quest_type": "complete_circuit_mission", "title": "Complete a verified circuit mission",
            "description": "Build and submit a verified circuit objective.", "target_count": 1,
            "current_count": 1 if f"daily:circuit:{today}" in today_keys else 0,
            "completed": f"daily:circuit:{today}" in today_keys, "xp_reward": 20, "route": "/circuit",
        }]

    @staticmethod
    def _weekly_quests(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_rewards = [r for r in rewards if r.get("created_at", "") >= week_start.isoformat()]
        circuit_missions_this_week = len({r["source_id"] for r in week_rewards if r.get("source_type") == "circuit_mission"})
        distinct_days = len({str(r.get("created_at", ""))[:10] for r in week_rewards})
        return [
            {
                "id": "weekly-circuits", "quest_type": "complete_circuit_missions_weekly",
                "title": "Complete 2 circuit missions this week",
                "description": "Build and submit two distinct circuit missions.",
                "target_count": 2, "current_count": min(circuit_missions_this_week, 2),
                "completed": circuit_missions_this_week >= 2, "xp_reward": 40, "route": "/circuit",
            },
            {
                "id": "weekly-active-days", "quest_type": "active_days_weekly",
                "title": "Learn on 3 different days this week",
                "description": "Earn verified rewards on at least 3 distinct days.",
                "target_count": 3, "current_count": min(distinct_days, 3),
                "completed": distinct_days >= 3, "xp_reward": 50, "route": "/dashboard",
            },
        ]

    @staticmethod
    def _reward_history(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Return a recent reward history feed (most recent first, max 20)."""
        sorted_rewards = sorted(rewards, key=lambda r: r.get("created_at", ""), reverse=True)[:20]
        return [
            {
                "event_type": r.get("source_type", ""),
                "event_key": r.get("source_id", ""),
                "created_at": r.get("created_at", ""),
            }
            for r in sorted_rewards
        ]

    async def award(self, user_id: str, event_type: str, event_key: str) -> dict[str, Any]:
        validate_reward_source(event_type, event_key)
        # The database function owns the persisted amount and uniqueness check;
        # this service validates the event contract before making the RPC.
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/award_gamification_reward",
                headers=self._headers(),
                json={"p_user_id": user_id, "p_event_type": event_type, "p_event_key": event_key},
            )
        if response.status_code >= 400:
            raise RuntimeError("The reward could not be recorded. Confirm that migration 15_gamification.sql has been applied.")
        return response.json()

    async def record_repair_attempt(self, user_id: str, challenge_id: str, operations: list[dict], result: dict[str, Any], hints_used: int) -> dict[str, Any] | None:
        """Persist every evaluated attempt; only a verified pass can call the XP RPC."""
        await self._request("POST", "challenge_attempts", headers={"Prefer": "return=minimal"}, json={
            "user_id": user_id, "challenge_id": challenge_id, "submitted_ops": operations,
            "score": result["fidelity"], "hints_used": hints_used,
            "mistake_tags": [] if result["passed"] else ["state_mismatch"],
        })
        if not result["passed"]:
            return None
        challenge = __import__("app.services.repair_service", fromlist=["public_challenge"]).public_challenge(challenge_id)
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/award_repair_circuit_reward",
                headers=self._headers(),
                json={"p_user_id": user_id, "p_challenge_id": challenge_id, "p_tier": challenge["tier"], "p_hints_used": hints_used},
            )
        if response.status_code >= 400:
            raise RuntimeError("The repair was verified but its reward could not be recorded. Apply migration 19_repair_circuit_attempts.sql.")
        return response.json()


store = GamificationStore()

ACHIEVEMENTS = {
    "first-circuit": {"name": "Circuit Explorer", "desc": "Completed your first verified circuit mission.", "icon": "⚛️"},
    "first-repair": {"name": "Repair Initiate", "desc": "Completed your first verified circuit repair.", "icon": "🛠️"},
    "clean-repair": {"name": "Clean Repair", "desc": "Completed a verified circuit repair without hints.", "icon": "✨"},
    "circuit_builder": {"name": "Circuit Builder", "desc": "Completed five verified circuit missions or repairs.", "icon": "🔧"},
    "first-contest": {"name": "Quantum Competitor", "desc": "Earned a reward from a qualifying contest solution.", "icon": "🏁"},
    "xp-100": {"name": "Century of Discovery", "desc": "Reached 100 verified XP.", "icon": "💯"},
    "bell-state": {"name": "Entanglement Pioneer", "desc": "Built a verified Bell state circuit.", "icon": "🔗"},
    "superposition-master": {"name": "Superposition Master", "desc": "Created a verified superposition circuit.", "icon": "🌊"},
    "streak-3": {"name": "Consistency Keeper", "desc": "Maintained a 3-day learning streak.", "icon": "🔥"},
    "streak-7": {"name": "Quantum Marathoner", "desc": "Maintained a 7-day learning streak.", "icon": "⭐"},
    "streak_7": {"name": "Week Warrior", "desc": "Earned verified learning rewards on seven consecutive UTC days.", "icon": "🔥"},
    "xp-500": {"name": "Half Millennium", "desc": "Reached 500 verified XP.", "icon": "🎖️"},
    "xp-1000": {"name": "Quantum Kilobyte", "desc": "Reached 1000 verified XP.", "icon": "🏅"},
    "all-missions": {"name": "Mission Complete", "desc": "Completed all available circuit missions.", "icon": "🎯"},
    "daily-quest-5": {"name": "Quest Apprentice", "desc": "Completed 5 daily quests.", "icon": "📋"},
}
