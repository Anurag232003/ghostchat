import time
import math
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import AddXPRequest, UnlockAchievementRequest

router = APIRouter(prefix="/api/blind-date-xp", tags=["Blind Date XP"])

USER_XP_PROFILES: Dict[str, Dict[str, Any]] = {}

ACHIEVEMENTS_CATALOG = [
    {
        "id": "first_blind_date",
        "emoji": "🏆",
        "name": "First Blind Date",
        "badge": "🏆 First Blind Date",
        "description": "Completed your inaugural anonymous encounter.",
        "xp_reward": 100
    },
    {
        "id": "mystery_master",
        "emoji": "🎭",
        "name": "Mystery Master",
        "badge": "🎭 Mystery Master",
        "description": "Reached Level 10+ under complete mutual pseudonymity.",
        "xp_reward": 250
    },
    {
        "id": "conversation_starter",
        "emoji": "💬",
        "name": "Conversation Starter",
        "badge": "💬 Conversation Starter",
        "description": "Answered 20+ icebreaker question cards and sparked engaging dialogue.",
        "xp_reward": 75
    },
    {
        "id": "puzzle_solver",
        "emoji": "🧩",
        "name": "Puzzle Solver",
        "badge": "🧩 Puzzle Solver",
        "description": "Solved collaborative compatibility puzzles during dates.",
        "xp_reward": 80
    },
    {
        "id": "night_owl",
        "emoji": "🌙",
        "name": "Night Owl",
        "badge": "🌙 Night Owl",
        "description": "Connected and chatted during mystical late-night hours (11 PM - 4 AM).",
        "xp_reward": 90
    },
    {
        "id": "mutual_reveal",
        "emoji": "❤️",
        "name": "Mutual Reveal",
        "badge": "❤️ Mutual Reveal",
        "description": "Achieved mutual Continue or unlocked progressive identity reveal.",
        "xp_reward": 150
    }
]

XP_ACTION_REWARDS = {
    "complete_date": {"xp": 100, "stat": "dates_completed"},
    "play_game": {"xp": 25, "stat": "games_played"},
    "answer_question": {"xp": 15, "stat": "questions_answered"},
    "mutual_reveal": {"xp": 150, "stat": None},
    "puzzle_solve": {"xp": 50, "stat": "games_played"}
}

def get_rank_title(level: int) -> str:
    if level < 5:
        return "Mystery Novice"
    elif level < 10:
        return "Shadow Seeker"
    elif level < 15:
        return "Mystery Explorer"
    elif level < 20:
        return "Cipher Vanguard"
    else:
        return "Enigma Legend"

def create_default_xp_profile(user_id: str) -> Dict[str, Any]:
    level = 1
    xp = 0
    return {
        "user_id": user_id,
        "title": get_rank_title(level),
        "level": level,
        "current_xp": xp,
        "xp_for_next_level": 200,
        "level_progress_pct": 0.0,
        "stats": {
            "dates_completed": 0,
            "games_played": 0,
            "questions_answered": 0
        },
        "unlocked_achievements": [],
        "updated_at": time.time()
    }

@router.get("/manifest")
async def get_xp_manifest():
    """Returns gamification levels, actions reward table, and achievements catalog."""
    return {
        "status": "success",
        "feature": "🏆 Blind Date XP",
        "canonical_spec": {
            "title": "Mystery Explorer",
            "level": "Lv. 12",
            "stats": {
                "dates_completed": 18,
                "games_played": 34,
                "questions_answered": 92
            },
            "achievements": [
                "🏆 First Blind Date",
                "🎭 Mystery Master",
                "💬 Conversation Starter",
                "🧩 Puzzle Solver",
                "🌙 Night Owl",
                "❤️ Mutual Reveal"
            ]
        },
        "achievements": ACHIEVEMENTS_CATALOG,
        "action_rewards": XP_ACTION_REWARDS
    }

@router.get("/profile/{user_id}")
async def get_user_xp_profile(user_id: str):
    """Fetches user XP, level, rank title, activity stats, and unlocked achievements."""
    prof = USER_XP_PROFILES.get(user_id)
    db = get_db()
    if not prof and db is not None:
        doc = await db.user_xp_profiles.find_one({"user_id": user_id}, {"_id": 0})
        if doc:
            prof = doc
            USER_XP_PROFILES[user_id] = prof

    if not prof:
        prof = create_default_xp_profile(user_id)
        USER_XP_PROFILES[user_id] = prof

    # Map achievements with catalog status
    achievements_status = []
    unlocked_ids = set(prof.get("unlocked_achievements", []))
    for ach in ACHIEVEMENTS_CATALOG:
        achievements_status.append({
            **ach,
            "unlocked": ach["id"] in unlocked_ids
        })

    return {
        "status": "success",
        "profile": prof,
        "achievements": achievements_status,
        "rank_display": f"{prof['title']} • Lv. {prof['level']}"
    }

@router.post("/add-xp")
async def add_user_xp(req: AddXPRequest):
    """
    Awards XP for an action and auto-increments progression counters.
    """
    prof = USER_XP_PROFILES.get(req.user_id)
    if not prof:
        prof = create_default_xp_profile(req.user_id)

    reward_meta = XP_ACTION_REWARDS.get(req.action_type, {"xp": 25, "stat": None})
    added_xp = req.custom_xp if req.custom_xp is not None else reward_meta["xp"]

    # Increment stat counter if applicable
    stat_key = reward_meta.get("stat")
    if stat_key:
        prof["stats"][stat_key] = prof["stats"].get(stat_key, 0) + 1

    # Add XP & calculate level
    prof["current_xp"] += added_xp
    new_level = 1 + int(prof["current_xp"] // 200)
    prof["level"] = new_level
    prof["title"] = get_rank_title(new_level)
    prof["xp_for_next_level"] = new_level * 200
    prof["level_progress_pct"] = round(((prof["current_xp"] % 200) / 200) * 100, 1)
    prof["updated_at"] = time.time()

    # Auto-unlock checks
    unlocked_new = []
    unlocked_set = set(prof.get("unlocked_achievements", []))

    if prof["stats"]["dates_completed"] >= 1 and "first_blind_date" not in unlocked_set:
        unlocked_set.add("first_blind_date")
        unlocked_new.append("first_blind_date")

    if prof["level"] >= 10 and "mystery_master" not in unlocked_set:
        unlocked_set.add("mystery_master")
        unlocked_new.append("mystery_master")

    if prof["stats"]["questions_answered"] >= 20 and "conversation_starter" not in unlocked_set:
        unlocked_set.add("conversation_starter")
        unlocked_new.append("conversation_starter")

    prof["unlocked_achievements"] = list(unlocked_set)
    USER_XP_PROFILES[req.user_id] = prof

    db = get_db()
    if db is not None:
        await db.user_xp_profiles.update_one(
            {"user_id": req.user_id},
            {"$set": prof},
            upsert=True
        )

    return {
        "status": "xp_awarded",
        "added_xp": added_xp,
        "action_type": req.action_type,
        "current_xp": prof["current_xp"],
        "level": prof["level"],
        "title": prof["title"],
        "unlocked_new": unlocked_new,
        "profile": prof
    }

@router.post("/unlock-achievement")
async def unlock_achievement(req: UnlockAchievementRequest):
    """Directly unlocks an achievement badge."""
    prof = USER_XP_PROFILES.get(req.user_id)
    if not prof:
        prof = create_default_xp_profile(req.user_id)

    ach_info = next((a for a in ACHIEVEMENTS_CATALOG if a["id"] == req.achievement_id), None)
    if not ach_info:
        raise HTTPException(status_code=404, detail="Achievement not found in catalog")

    unlocked_set = set(prof.get("unlocked_achievements", []))
    if req.achievement_id not in unlocked_set:
        unlocked_set.add(req.achievement_id)
        prof["unlocked_achievements"] = list(unlocked_set)
        prof["current_xp"] += ach_info["xp_reward"]
        new_level = 1 + int(prof["current_xp"] // 200)
        prof["level"] = new_level
        prof["title"] = get_rank_title(new_level)
        prof["updated_at"] = time.time()

    USER_XP_PROFILES[req.user_id] = prof

    db = get_db()
    if db is not None:
        await db.user_xp_profiles.update_one(
            {"user_id": req.user_id},
            {"$set": prof},
            upsert=True
        )

    return {
        "status": "unlocked",
        "achievement": ach_info,
        "profile": prof
    }
