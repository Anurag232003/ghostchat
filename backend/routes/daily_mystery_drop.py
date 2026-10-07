import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends

from backend.database import get_db
from backend.models import (
    DailyMysteryMatch,
    DailyMysteryDropStatus,
    OpenDailyDropRequest,
    ConnectDailyDropRequest,
    PassDailyDropRequest,
)

router = APIRouter(prefix="/api/daily-mystery-drop", tags=["daily-mystery-drop"])

# In-memory store: user_id -> date_str -> state dict
_user_daily_drops: Dict[str, Dict[str, Dict[str, Any]]] = {}

def _get_today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _get_seconds_until_next_drop() -> int:
    now = datetime.now(timezone.utc)
    seconds_past_midnight = now.hour * 3600 + now.minute * 60 + now.second
    return max(0, 86400 - seconds_past_midnight)

async def _get_or_create_drop(user_id: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    if not date_str:
        date_str = _get_today_date_str()
    
    if user_id not in _user_daily_drops:
        _user_daily_drops[user_id] = {}
        
    if date_str not in _user_daily_drops[user_id]:
        db = get_db()
        real_users = []
        if db is not None:
            cursor = db.users.find({"user_id": {"$ne": user_id}})
            real_users = await cursor.to_list(length=100)

        if real_users:
            idx = (abs(hash(f"{user_id}:{date_str}")) % len(real_users))
            chosen = real_users[idx]
            prof = chosen.get("profile") or {}
            pseudonym = chosen.get("pseudonym") or f"Anon#{chosen['user_id'][-4:]}"
            drop_id = f"drop_{date_str}_{user_id[:8]}_{idx}"
            
            match_data = {
                "drop_id": drop_id,
                "match_date": date_str,
                "peer_id": chosen["user_id"],
                "peer_pseudonym": pseudonym,
                "avatar_symbol": prof.get("avatar_emoji") or "👤",
                "vibe_signature": prof.get("vibe") or "🌟 Authentic • Anonymous",
                "teaser_summary": prof.get("vibe") or f"A real registered user ({pseudonym}) waiting in the anonymous directory.",
                "compatibility_score": 85 + (abs(hash(chosen["user_id"])) % 14),
                "common_topics": prof.get("interests") if prof.get("interests") else ["Anonymous Chat", "Life"],
                "approx_location": "📍 Real Registered User",
                "conversation_style_bar": "████████░░",
                "energy_bar": "███████░░░",
                "window_duration_seconds": 1800,  # 30 minutes
            }
            
            _user_daily_drops[user_id][date_str] = {
                "user_id": user_id,
                "drop_date": date_str,
                "status": "ready",
                "match": match_data,
                "opened_at": None,
                "connected_at": None,
                "passed_at": None,
                "created_at": time.time(),
            }
        else:
            # Zero other real users in database yet
            _user_daily_drops[user_id][date_str] = {
                "user_id": user_id,
                "drop_date": date_str,
                "status": "no_candidates",
                "match": None,
                "opened_at": None,
                "connected_at": None,
                "passed_at": None,
                "created_at": time.time(),
            }
        
    return _user_daily_drops[user_id][date_str]

@router.get("/manifest")
def get_daily_mystery_drop_manifest() -> Dict[str, Any]:
    return {
        "feature_number": 28,
        "feature_name": "Daily Mystery Drop",
        "icon": "🔥",
        "headline": "Your mystery connection is waiting.",
        "cadence": "Every day: ONE MYSTERY MATCH",
        "window_duration_minutes": 30,
        "window_duration_seconds": 1800,
        "purpose": "This gives users a reason to return.",
        "characteristics": [
            "Every day: ONE MYSTERY MATCH",
            "Available for 30 minutes once discovered",
            "High-compatibility curated anonymous signal",
            "Zero pressure: Instant connect or pass until tomorrow",
            "Automatic expiration after 30-minute countdown",
            "Gives users a daily ritual to return"
        ]
    }

@router.get("/status/{user_id}")
async def get_daily_mystery_drop_status(user_id: str) -> DailyMysteryDropStatus:
    date_str = _get_today_date_str()
    record = await _get_or_create_drop(user_id, date_str)
    
    if not record.get("match"):
        return DailyMysteryDropStatus(
            user_id=user_id,
            drop_date=date_str,
            title="🔥 DAILY MYSTERY DROP",
            subtitle="Every day: ONE MYSTERY MATCH • Available for 30 minutes",
            headline="Your mystery connection is waiting.",
            status="no_candidates",
            match=None,
            opened_at=None,
            time_remaining_seconds=0,
            next_drop_countdown_seconds=_get_seconds_until_next_drop(),
            is_claimed_today=False,
            purpose_note="Zero demo bots. Real registered connections only."
        )

    opened_at = record.get("opened_at")
    status = record.get("status", "ready")
    window_seconds = record["match"]["window_duration_seconds"]
    
    if opened_at is not None:
        elapsed = time.time() - opened_at
        if elapsed >= window_seconds:
            if status == "active":
                status = "expired"
                record["status"] = "expired"
            time_remaining = 0
        else:
            time_remaining = max(0, int(window_seconds - elapsed))
    else:
        time_remaining = window_seconds
        
    next_drop_countdown = _get_seconds_until_next_drop()
    is_claimed = status in ["connected", "passed"]

    return DailyMysteryDropStatus(
        user_id=user_id,
        drop_date=date_str,
        title="🔥 DAILY MYSTERY DROP",
        subtitle="Every day: ONE MYSTERY MATCH • Available for 30 minutes",
        headline="Your mystery connection is waiting.",
        status=status,
        match=DailyMysteryMatch(**record["match"]),
        opened_at=opened_at,
        time_remaining_seconds=time_remaining,
        next_drop_countdown_seconds=next_drop_countdown,
        is_claimed_today=is_claimed,
        purpose_note="This gives users a reason to return.",
    )

@router.post("/open")
async def open_daily_mystery_drop(req: OpenDailyDropRequest) -> Dict[str, Any]:
    date_str = _get_today_date_str()
    record = await _get_or_create_drop(req.user_id, date_str)
    
    if not record.get("match"):
        return {
            "success": False,
            "status": "no_candidates",
            "message": "No other registered users in the network yet."
        }

    now = time.time()
    if record.get("opened_at") is None:
        record["opened_at"] = now
        record["status"] = "active"
    elif record.get("status") == "ready":
        record["status"] = "active"
        
    elapsed = now - record["opened_at"]
    window_seconds = record["match"]["window_duration_seconds"]
    if elapsed >= window_seconds:
        record["status"] = "expired"
        remaining = 0
    else:
        remaining = int(window_seconds - elapsed)

    return {
        "success": True,
        "status": record["status"],
        "opened_at": record["opened_at"],
        "time_remaining_seconds": remaining,
        "match": record["match"],
        "headline": "Your mystery connection is waiting.",
        "message": "Today's 30-minute mystery drop window is now live!",
    }

@router.post("/connect")
async def connect_daily_mystery_drop(req: ConnectDailyDropRequest) -> Dict[str, Any]:
    date_str = _get_today_date_str()
    record = await _get_or_create_drop(req.user_id, date_str)
    
    if not record.get("match"):
        raise HTTPException(status_code=404, detail="No match available to connect.")

    if record["match"]["drop_id"] != req.drop_id:
        raise HTTPException(status_code=400, detail="Invalid drop_id for today's match.")
        
    if record.get("opened_at"):
        elapsed = time.time() - record["opened_at"]
        if elapsed >= record["match"]["window_duration_seconds"]:
            record["status"] = "expired"
            raise HTTPException(status_code=410, detail="Today's 30-minute mystery drop has expired.")
            
    record["status"] = "connected"
    record["connected_at"] = time.time()
    
    chat_room_id = f"mystery_drop_room_{req.drop_id}"
    
    return {
        "success": True,
        "status": "connected",
        "drop_id": req.drop_id,
        "peer_id": record["match"]["peer_id"],
        "peer_pseudonym": record["match"]["peer_pseudonym"],
        "chat_room_id": chat_room_id,
        "headline": "Connection unlocked! Your mystery conversation has begun.",
        "xp_reward": 75,
    }

@router.post("/pass")
async def pass_daily_mystery_drop(req: PassDailyDropRequest) -> Dict[str, Any]:
    date_str = _get_today_date_str()
    record = await _get_or_create_drop(req.user_id, date_str)
    
    if not record.get("match"):
        return {"success": True, "status": "passed"}

    if record["match"]["drop_id"] != req.drop_id:
        raise HTTPException(status_code=400, detail="Invalid drop_id for today's match.")
        
    record["status"] = "passed"
    record["passed_at"] = time.time()
    
    return {
        "success": True,
        "status": "passed",
        "message": "Passed on today's mystery match. Next mystery drop arrives tomorrow!",
        "next_drop_countdown_seconds": _get_seconds_until_next_drop(),
    }

@router.post("/reset-demo")
async def reset_daily_mystery_drop_demo(req: OpenDailyDropRequest) -> Dict[str, Any]:
    date_str = _get_today_date_str()
    if req.user_id in _user_daily_drops and date_str in _user_daily_drops[req.user_id]:
        del _user_daily_drops[req.user_id][date_str]
        
    record = await _get_or_create_drop(req.user_id, date_str)
    return {
        "success": True,
        "message": "Today's daily mystery drop refreshed with real database users.",
        "drop": record,
    }
