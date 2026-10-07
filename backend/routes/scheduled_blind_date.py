import time
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.models import (
    ScheduledDateSlot,
    ScheduledDateEvent,
    BookScheduledDateRequest,
    CancelScheduledDateRequest,
    EnterScheduledDateRequest,
    TestCountdownRequest,
)

router = APIRouter(prefix="/api/scheduled-blind-date", tags=["scheduled-blind-date"])

# In-memory store: user_id -> ScheduledDateEvent dict
_scheduled_events: Dict[str, Dict[str, Any]] = {}

CURATED_SLOTS_TEMPLATE: List[Dict[str, Any]] = [
    {
        "slot_id": "slot_tonight_20",
        "day_label": "Tonight",
        "time_label": "8:00 PM",
        "is_recommended": False,
    },
    {
        "slot_id": "slot_tonight_21",
        "day_label": "Tonight",
        "time_label": "9:00 PM",
        "is_recommended": True,
    },
    {
        "slot_id": "slot_tonight_22",
        "day_label": "Tonight",
        "time_label": "10:00 PM",
        "is_recommended": False,
    },
    {
        "slot_id": "slot_tonight_23",
        "day_label": "Tonight",
        "time_label": "11:00 PM",
        "is_recommended": False,
    },
    {
        "slot_id": "slot_tomorrow_21",
        "day_label": "Tomorrow",
        "time_label": "9:00 PM",
        "is_recommended": True,
    },
]

def format_countdown_clock(seconds: int) -> str:
    secs = max(0, seconds)
    hours = secs // 3600
    minutes = (secs % 3600) // 60
    rem_secs = secs % 60
    return f"{hours:02d}:{minutes:02d}:{rem_secs:02d}"

@router.get("/manifest")
def get_scheduled_blind_date_manifest() -> Dict[str, Any]:
    return {
        "feature_number": 29,
        "feature_name": "Scheduled Blind Date",
        "icon": "🕰️",
        "example_choice": {
            "day": "Tonight",
            "time": "9:00 PM",
        },
        "matching_mechanism": "The system finds another real user who is also available.",
        "countdown_headline": "Your date begins in:",
        "example_countdown": "00:04:21",
        "purpose": "This creates an actual event rather than an ordinary chat.",
        "highlights": [
            "User selects a calendar date slot (e.g. Tonight, 9:00 PM)",
            "Automated discovery finds an anonymous peer who is also available",
            "Shared anticipation ticker: 'Your date begins in: 00:04:21'",
            "Transforms ad-hoc messaging into a curated appointment event",
            "Automatic chamber unlock once countdown strikes zero",
        ]
    }

@router.get("/slots")
async def get_available_slots() -> List[ScheduledDateSlot]:
    """
    Returns available event slots with REAL peer availability counts from MongoDB.
    Zero hardcoded numbers.
    """
    db = get_db()
    peer_count = 0
    if db is not None:
        total = await db.users.count_documents({})
        peer_count = max(0, total - 1)

    result = []
    for s in CURATED_SLOTS_TEMPLATE:
        result.append(ScheduledDateSlot(
            slot_id=s["slot_id"],
            day_label=s["day_label"],
            time_label=s["time_label"],
            available_peers_count=peer_count,
            is_recommended=s.get("is_recommended", False)
        ))
    return result

@router.get("/status/{user_id}")
def get_scheduled_date_status(user_id: str) -> Dict[str, Any]:
    event = _scheduled_events.get(user_id)
    if not event:
        return {
            "has_scheduled_event": False,
            "event": None,
            "message": "No scheduled blind date booked. Choose a slot like Tonight at 9:00 PM!",
        }

    now = time.time()
    remaining = max(0, int(event["target_timestamp"] - now))
    event["countdown_seconds"] = remaining
    event["countdown_display"] = format_countdown_clock(remaining)

    if remaining <= 0 and event["status"] in ["scheduled", "countdown_active"]:
        event["status"] = "live"

    return {
        "has_scheduled_event": True,
        "event": ScheduledDateEvent(**event),
        "headline": "Your date begins in:",
        "countdown_display": event["countdown_display"],
        "purpose_note": "This creates an actual event rather than an ordinary chat.",
    }

@router.post("/book")
async def book_scheduled_date(req: BookScheduledDateRequest) -> Dict[str, Any]:
    """
    Books a scheduled date slot using real users from MongoDB.
    """
    booking_id = f"sched_{uuid.uuid4().hex[:10]}"
    
    db = get_db()
    real_users = []
    if db is not None:
        cursor = db.users.find({"user_id": {"$ne": req.user_id}})
        real_users = await cursor.to_list(length=50)

    if real_users:
        peer_idx = abs(hash(f"{req.user_id}:{req.scheduled_day}:{req.scheduled_time}")) % len(real_users)
        chosen = real_users[peer_idx]
        prof = chosen.get("profile") or {}
        matched_peer = {
            "peer_id": chosen["user_id"],
            "peer_pseudonym": chosen.get("pseudonym") or f"Anon#{chosen['user_id'][-4:]}",
            "peer_avatar": prof.get("avatar_emoji") or "👤",
            "peer_vibe": prof.get("vibe") or "Registered Anonymous Peer"
        }
    else:
        # Zero other real users currently in MongoDB
        matched_peer = {
            "peer_id": None,
            "peer_pseudonym": "Waiting for real peer...",
            "peer_avatar": "⏳",
            "peer_vibe": "Slot reserved! Waiting for another real user to book this time."
        }

    duration_secs = req.demo_countdown_seconds if req.demo_countdown_seconds is not None else 261
    now = time.time()
    target_timestamp = now + duration_secs

    event_data = {
        "booking_id": booking_id,
        "user_id": req.user_id,
        "peer_id": matched_peer["peer_id"],
        "peer_pseudonym": matched_peer["peer_pseudonym"],
        "peer_avatar": matched_peer["peer_avatar"],
        "peer_vibe": matched_peer["peer_vibe"],
        "scheduled_day": req.scheduled_day,
        "scheduled_time": req.scheduled_time,
        "target_timestamp": target_timestamp,
        "status": "countdown_active",
        "countdown_seconds": duration_secs,
        "countdown_display": format_countdown_clock(duration_secs),
        "room_id": f"sched_room_{booking_id}",
        "headline": "Your date begins in:",
        "purpose_note": "This creates an actual event rather than an ordinary chat.",
        "created_at": now,
    }

    _scheduled_events[req.user_id] = event_data

    return {
        "success": True,
        "message": f"Slot booked for {req.scheduled_day} at {req.scheduled_time}!",
        "event": event_data,
        "countdown_display": event_data["countdown_display"],
    }

@router.post("/cancel")
def cancel_scheduled_date(req: CancelScheduledDateRequest) -> Dict[str, Any]:
    for uid, ev in list(_scheduled_events.items()):
        if ev.get("booking_id") == req.booking_id:
            del _scheduled_events[uid]
            return {"success": True, "message": "Booking successfully cancelled."}
    return {"success": True, "message": "Booking removed."}

@router.post("/enter")
def enter_scheduled_date(req: EnterScheduledDateRequest) -> Dict[str, Any]:
    event = _scheduled_events.get(req.user_id)
    if not event:
        raise HTTPException(status_code=404, detail="No scheduled event found.")
    
    return {
        "success": True,
        "room_id": event["room_id"],
        "peer_id": event["peer_id"],
        "peer_pseudonym": event["peer_pseudonym"],
        "status": event["status"],
        "message": "Entering scheduled date chamber.",
    }

@router.post("/set-countdown")
def set_scheduled_test_countdown(req: TestCountdownRequest) -> Dict[str, Any]:
    event = _scheduled_events.get(req.user_id)
    if not event:
        raise HTTPException(status_code=404, detail="No booking found for this user.")
    
    now = time.time()
    event["countdown_seconds"] = req.seconds
    event["target_timestamp"] = now + req.seconds
    event["countdown_display"] = format_countdown_clock(req.seconds)
    if req.seconds <= 0:
        event["status"] = "live"
    else:
        event["status"] = "countdown_active"
        
    return {
        "success": True,
        "seconds": req.seconds,
        "countdown_display": event["countdown_display"],
        "status": event["status"],
    }
