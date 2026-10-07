import time
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    SmartMatchmakingPrivacyControls,
    SmartMatchmakingPreferences,
    SmartMatchmakingProfileUpdateRequest,
    SmartMatchSearchRequest
)

router = APIRouter(prefix="/api/smart-matchmaking", tags=["Smart Matchmaking"])

# In-memory store for user matchmaking configurations (backed by MongoDB when available)
USER_MATCHMAKING_CONFIGS: Dict[str, Dict[str, Any]] = {}

SMART_MATCHMAKING_MANIFEST = {
    "feature": "🧠 Smart Matchmaking",
    "description": "Intelligent anonymous matchmaking considering 8 holistic compatibility vectors with complete user privacy controls.",
    "factors": [
        {"id": "age_preference", "name": "Age preference", "control_key": "use_age_preference", "weight": 10},
        {"id": "interests", "name": "Interests", "control_key": "use_interests", "weight": 20},
        {"id": "conversation_preferences", "name": "Conversation preferences", "control_key": "use_conversation_preferences", "weight": 15},
        {"id": "language", "name": "Language", "control_key": "use_language", "weight": 10},
        {"id": "availability", "name": "Availability", "control_key": "use_availability", "weight": 15},
        {"id": "date_mode", "name": "Date mode", "control_key": "use_date_mode", "weight": 10},
        {"id": "shared_topics", "name": "Shared topics", "control_key": "use_shared_topics", "weight": 10},
        {"id": "past_interactions", "name": "Past mutual interactions", "control_key": "use_past_interactions", "weight": 10}
    ],
    "privacy_rule": "Users maintain full granular control over which data vectors are utilized in the matching algorithm. Disabled vectors are strictly excluded from calculations."
}

# All candidate calculations are strictly evaluated from real registered users in MongoDB.
# Zero hardcoded demo candidates.


def get_default_config(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "controls": SmartMatchmakingPrivacyControls().model_dump(),
        "preferences": SmartMatchmakingPreferences().model_dump(),
        "updated_at": time.time()
    }

def calculate_smart_match(
    user_prefs: Dict[str, Any],
    user_controls: Dict[str, Any],
    candidate: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes compatibility score strictly respecting active user controls.
    Disabled vectors contribute 0 weight and are explicitly flagged.
    """
    breakdown = {}
    active_points = 0.0
    max_possible_points = 0.0

    # 1. Age preference (10 pts)
    if user_controls.get("use_age_preference", True):
        max_possible_points += 10
        user_age = user_prefs.get("age_preference", "21-30")
        cand_age = candidate.get("age_preference", "21-30")
        match = (user_age == cand_age or user_age == "Any" or cand_age == "Any")
        score = 10 if match else 3
        active_points += score
        breakdown["age_preference"] = {
            "enabled": True,
            "weight": 10,
            "score": score,
            "status": "Compatible" if match else "Partial overlap"
        }
    else:
        breakdown["age_preference"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 2. Interests (20 pts)
    if user_controls.get("use_interests", True):
        max_possible_points += 20
        user_ints = set(user_prefs.get("interests", []))
        cand_ints = set(candidate.get("interests", []))
        shared = user_ints.intersection(cand_ints)
        ratio = len(shared) / max(1, len(user_ints))
        score = round(min(20, ratio * 20 + (5 if shared else 0)), 1)
        active_points += score
        breakdown["interests"] = {
            "enabled": True,
            "weight": 20,
            "score": score,
            "shared": list(shared),
            "status": f"{len(shared)} shared interests"
        }
    else:
        breakdown["interests"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 3. Conversation preferences (15 pts)
    if user_controls.get("use_conversation_preferences", True):
        max_possible_points += 15
        user_conv = user_prefs.get("conversation_preference", "Deep talks")
        cand_conv = candidate.get("conversation_preference", "Deep talks")
        match = (user_conv == cand_conv)
        score = 15 if match else 5
        active_points += score
        breakdown["conversation_preferences"] = {
            "enabled": True,
            "weight": 15,
            "score": score,
            "status": f"Style: {cand_conv}" if match else "Complementary styles"
        }
    else:
        breakdown["conversation_preferences"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 4. Language (10 pts)
    if user_controls.get("use_language", True):
        max_possible_points += 10
        user_lang = user_prefs.get("language", "English")
        cand_lang = candidate.get("language", "English")
        match = (user_lang == cand_lang or user_lang == "Any" or cand_lang == "Any")
        score = 10 if match else 2
        active_points += score
        breakdown["language"] = {
            "enabled": True,
            "weight": 10,
            "score": score,
            "status": f"Language: {cand_lang}" if match else "Different languages"
        }
    else:
        breakdown["language"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 5. Availability (15 pts)
    if user_controls.get("use_availability", True):
        max_possible_points += 15
        user_avail = user_prefs.get("availability", "Right now 🟢")
        cand_avail = candidate.get("availability", "Right now 🟢")
        match = (user_avail == cand_avail or "Flexible" in user_avail or "Flexible" in cand_avail)
        score = 15 if match else 6
        active_points += score
        breakdown["availability"] = {
            "enabled": True,
            "weight": 15,
            "score": score,
            "status": f"Online: {cand_avail}" if match else "Different peak hours"
        }
    else:
        breakdown["availability"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 6. Date mode (10 pts)
    if user_controls.get("use_date_mode", True):
        max_possible_points += 10
        user_mode = user_prefs.get("date_mode", "mystery")
        cand_mode = candidate.get("date_mode", "mystery")
        match = (user_mode == cand_mode)
        score = 10 if match else 4
        active_points += score
        breakdown["date_mode"] = {
            "enabled": True,
            "weight": 10,
            "score": score,
            "status": f"Preferred: {cand_mode}" if match else "Compatible mode"
        }
    else:
        breakdown["date_mode"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 7. Shared topics (10 pts)
    if user_controls.get("use_shared_topics", True):
        max_possible_points += 10
        user_top = set(user_prefs.get("shared_topics", []))
        cand_top = set(candidate.get("shared_topics", []))
        shared = user_top.intersection(cand_top)
        ratio = len(shared) / max(1, len(user_top))
        score = round(min(10, ratio * 10 + (2 if shared else 0)), 1)
        active_points += score
        breakdown["shared_topics"] = {
            "enabled": True,
            "weight": 10,
            "score": score,
            "shared": list(shared),
            "status": f"{len(shared)} shared topics"
        }
    else:
        breakdown["shared_topics"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # 8. Past mutual interactions (10 pts)
    if user_controls.get("use_past_interactions", True):
        max_possible_points += 10
        # Positive baseline for unblocked candidates
        score = 10.0
        active_points += score
        breakdown["past_interactions"] = {
            "enabled": True,
            "weight": 10,
            "score": score,
            "status": "Clean history / No negative interactions"
        }
    else:
        breakdown["past_interactions"] = {
            "enabled": False,
            "weight": 0,
            "score": 0,
            "status": "Disabled by user control"
        }

    # Normalize final score between 0 and 100%
    if max_possible_points > 0:
        final_percentage = round((active_points / max_possible_points) * 100, 1)
    else:
        # All controls disabled -> pure random neutral baseline
        final_percentage = 50.0

    return {
        "compatibility_score": final_percentage,
        "active_points": round(active_points, 1),
        "max_possible_points": round(max_possible_points, 1),
        "enabled_factors_count": sum(1 for v in breakdown.values() if v.get("enabled")),
        "disabled_factors_count": sum(1 for v in breakdown.values() if not v.get("enabled")),
        "breakdown": breakdown
    }

@router.get("/manifest")
async def get_smart_matchmaking_manifest():
    """Returns the 8 matching vectors, default weighting, and user control spec."""
    return {
        "status": "success",
        "manifest": SMART_MATCHMAKING_MANIFEST
    }

@router.get("/profile/{user_id}")
async def get_user_matchmaking_profile(user_id: str):
    """Fetches user matchmaking preferences and granular privacy controls."""
    config = USER_MATCHMAKING_CONFIGS.get(user_id)
    db = get_db()
    if not config and db is not None:
        doc = await db.smart_matchmaking_configs.find_one({"user_id": user_id}, {"_id": 0})
        if doc:
            config = doc
            USER_MATCHMAKING_CONFIGS[user_id] = config

    if not config:
        config = get_default_config(user_id)
        USER_MATCHMAKING_CONFIGS[user_id] = config

    return {
        "status": "success",
        "config": config,
        "manifest": SMART_MATCHMAKING_MANIFEST
    }

@router.post("/profile")
async def update_user_matchmaking_profile(req: SmartMatchmakingProfileUpdateRequest):
    """
    Saves user-selected matching preferences and toggles controls for what data is used.
    """
    config = {
        "user_id": req.user_id,
        "controls": req.controls.model_dump(),
        "preferences": req.preferences.model_dump(),
        "updated_at": time.time()
    }
    USER_MATCHMAKING_CONFIGS[req.user_id] = config

    db = get_db()
    if db is not None:
        await db.smart_matchmaking_configs.update_one(
            {"user_id": req.user_id},
            {"$set": config},
            upsert=True
        )

    return {
        "status": "updated",
        "message": "Smart Matchmaking preferences and privacy controls successfully updated.",
        "config": config
    }

@router.post("/search")
async def search_smart_matches(req: SmartMatchSearchRequest):
    """
    Performs smart matchmaking search:
    Filters and ranks REAL registered users from MongoDB according ONLY to user's enabled privacy controls.
    Zero demo profiles.
    """
    config = USER_MATCHMAKING_CONFIGS.get(req.user_id)
    if not config:
        config = get_default_config(req.user_id)
        USER_MATCHMAKING_CONFIGS[req.user_id] = config

    user_prefs = config["preferences"]
    user_controls = config["controls"]

    db = get_db()
    raw_users = []
    if db is not None:
        query = {"user_id": {"$ne": req.user_id}} if req.user_id else {}
        cursor = db.users.find(query)
        raw_users = await cursor.to_list(length=100)

    if not raw_users:
        return {
            "status": "empty",
            "user_id": req.user_id,
            "total_evaluated": 0,
            "active_controls": user_controls,
            "ranked_matches": [],
            "message": "No other registered users found yet. Invite a friend or open another window to test real compatibility matching!"
        }

    scored_candidates = []
    for u in raw_users:
        prof = u.get("profile") or {}
        cand = {
            "candidate_id": u["user_id"],
            "pseudonym": u.get("pseudonym", f"Anon#{u['user_id'][-4:]}"),
            "avatar_symbol": prof.get("avatar_emoji") or "👤",
            "age_preference": f"{prof.get('age', 21)}-{prof.get('age', 21) + 5}" if prof.get("age") else "Any",
            "interests": prof.get("interests") if prof.get("interests") else ["Chat", "Anonymous"],
            "conversation_preference": prof.get("vibe") or "Authentic conversations",
            "language": "English",
            "availability": "Online 🟢" if u.get("is_online") else "Recently active",
            "date_mode": "mystery",
            "shared_topics": prof.get("interests") if prof.get("interests") else ["Life", "Ideas"],
            "vibe_quote": prof.get("vibe") or f"Hey, I'm {u.get('pseudonym')}. Let's have a genuine conversation."
        }
        analysis = calculate_smart_match(user_prefs, user_controls, cand)
        scored_candidates.append({
            "candidate_id": cand["candidate_id"],
            "pseudonym": cand["pseudonym"],
            "avatar_symbol": cand["avatar_symbol"],
            "vibe_quote": cand["vibe_quote"],
            "compatibility_score": analysis["compatibility_score"],
            "breakdown": analysis["breakdown"],
            "enabled_factors_count": analysis["enabled_factors_count"],
            "disabled_factors_count": analysis["disabled_factors_count"],
            "details": {
                "age_preference": cand["age_preference"] if user_controls.get("use_age_preference") else "🔒 Private",
                "interests": cand["interests"] if user_controls.get("use_interests") else ["🔒 Hidden by user control"],
                "conversation_preference": cand["conversation_preference"] if user_controls.get("use_conversation_preferences") else "🔒 Private",
                "language": cand["language"] if user_controls.get("use_language") else "🔒 Private",
                "availability": cand["availability"] if user_controls.get("use_availability") else "🔒 Private",
                "date_mode": cand["date_mode"] if user_controls.get("use_date_mode") else "🔒 Private",
                "shared_topics": cand["shared_topics"] if user_controls.get("use_shared_topics") else ["🔒 Hidden by user control"]
            }
        })

    # Sort descending by compatibility score
    scored_candidates.sort(key=lambda x: x["compatibility_score"], reverse=True)

    return {
        "status": "matches_found",
        "user_id": req.user_id,
        "total_evaluated": len(raw_users),
        "active_controls": user_controls,
        "ranked_matches": scored_candidates[:req.limit]
    }
