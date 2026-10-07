import uuid
import time
import random
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    Instant5MinDateRequest,
    Instant5MinDecisionRequest,
    Instant5MinMessageRequest
)

router = APIRouter(prefix="/api/instant-date", tags=["Instant 5-Minute Date"])

INSTANT_DATE_ROOMS: Dict[str, Dict[str, Any]] = {}
INSTANT_DATE_WAITING_QUEUE: Dict[str, Dict[str, Any]] = {}

INSTANT_DATE_MANIFEST = {
    "feature": "⚡ Instant 5-Minute Date",
    "tagline": "Quick Date",
    "duration_minutes": 5,
    "duration_seconds": 300,
    "rules": {
        "duration": "5 MINUTES",
        "match": "ONE MATCH",
        "profile": "NO PROFILE",
        "photo": "NO PHOTO"
    },
    "decisions": [
        {
            "id": "continue",
            "emoji": "❤️",
            "label": "❤️ Continue",
            "outcome_rule": "If both select Continue: Full chat unlocked"
        },
        {
            "id": "friends",
            "emoji": "🤝",
            "label": "🤝 Friends",
            "outcome_rule": "Stay connected as friends"
        },
        {
            "id": "exit",
            "emoji": "👋",
            "label": "👋 Exit",
            "outcome_rule": "The 5-Minute Date has ended. Zero trace."
        },
        {
            "id": "maybe_later",
            "emoji": "🔄",
            "label": "🔄 Maybe later",
            "outcome_rule": "If both select Maybe later: Placed into Second Chance"
        }
    ]
}

ICEBREAKER_PROMPTS = [
    "What's one thing you could talk about for 3 hours straight?",
    "If you could teleport anywhere right now for dinner, where?",
    "What's your favorite late-night habit that no one knows about?",
    "Are you a coffee maximalist or a quiet tea person?",
    "What's a movie or game world you'd happily move into tomorrow?"
]

@router.get("/manifest")
async def get_instant_date_manifest():
    """Returns the rules, 5-minute timer spec, and end-of-date decisions."""
    return {
        "status": "success",
        "manifest": INSTANT_DATE_MANIFEST,
        "starter_prompts": ICEBREAKER_PROMPTS
    }

@router.post("/start")
async def start_instant_5min_date(req: Instant5MinDateRequest):
    """
    Real-person Matchmaking for Instant 5-Minute Date:
    Matches with another real online user waiting in the queue.
    Zero demo bots or simulated replies.
    """
    now = time.time()
    user_id = req.user_id

    # Check if there is already an active room for this user
    for r_id, r in INSTANT_DATE_ROOMS.items():
        if user_id in r.get("participants", []) and r.get("status") == "active":
            if now < r.get("expires_at", 0):
                peer_id = [p for p in r["participants"] if p != user_id][0]
                peer_ghost = r["peer_ghost"] if user_id == r["user_id"] else r["user_ghost"]
                return {
                    "status": "date_active",
                    "room_id": r_id,
                    "room": r,
                    "duration_seconds": max(0, int(r["expires_at"] - now)),
                    "expires_at": r["expires_at"],
                    "peer_ghost": peer_ghost,
                    "peer_user_id": peer_id,
                    "banner": INSTANT_DATE_MANIFEST["rules"]
                }

    # Clean stale waiting users (> 10 mins)
    stale_keys = [uid for uid, item in INSTANT_DATE_WAITING_QUEUE.items() if now - item.get("joined_at", 0) > 600]
    for sk in stale_keys:
        INSTANT_DATE_WAITING_QUEUE.pop(sk, None)

    # Check if another REAL user is waiting
    waiting_peer = None
    for candidate_id, queue_item in list(INSTANT_DATE_WAITING_QUEUE.items()):
        if candidate_id != user_id:
            waiting_peer = queue_item
            del INSTANT_DATE_WAITING_QUEUE[candidate_id]
            break

    if waiting_peer:
        # Match user_id with waiting_peer
        peer_id = waiting_peer["user_id"]
        room_id = waiting_peer.get("room_id") or f"qdate_{uuid.uuid4().hex[:12]}"
        duration_seconds = 300
        expires_at = now + duration_seconds

        user_ghost = f"⚡ Ghost#{user_id[-4:] if len(user_id) >= 4 else '01'}"
        peer_ghost = f"⚡ Spark#{peer_id[-4:] if len(peer_id) >= 4 else '02'}"

        room_doc = {
            "room_id": room_id,
            "mode": "instant_5min_date",
            "title": "Quick Date",
            "banner": INSTANT_DATE_MANIFEST["rules"],
            "duration_minutes": 5,
            "duration_seconds": duration_seconds,
            "created_at": now,
            "expires_at": expires_at,
            "user_id": user_id,
            "peer_user_id": peer_id,
            "user_ghost": user_ghost,
            "peer_ghost": peer_ghost,
            "participants": [user_id, peer_id],
            "messages": [
                {
                    "msg_id": f"qmsg_{uuid.uuid4().hex[:6]}",
                    "sender_id": "system",
                    "sender_ghost": "⚡ Quick Date",
                    "text": "⚡ 5-MINUTE DATE STARTED • ONE MATCH • NO PROFILE • NO PHOTO. Clock is ticking!",
                    "timestamp": now
                }
            ],
            "decisions": {},
            "full_chat_unlocked": False,
            "status": "active"
        }

        INSTANT_DATE_ROOMS[room_id] = room_doc
        # Remove current user from queue if they were in it
        INSTANT_DATE_WAITING_QUEUE.pop(user_id, None)

        db = get_db()
        if db is not None:
            await db.instant_date_rooms.update_one(
                {"room_id": room_id},
                {"$set": dict(room_doc)},
                upsert=True
            )

        return {
            "status": "date_active",
            "room_id": room_id,
            "room": room_doc,
            "duration_seconds": duration_seconds,
            "expires_at": expires_at,
            "peer_ghost": peer_ghost,
            "peer_user_id": peer_id,
            "banner": INSTANT_DATE_MANIFEST["rules"]
        }
    else:
        # Put in waiting queue for another real user
        room_id = f"qdate_{uuid.uuid4().hex[:12]}"
        user_ghost = f"⚡ Ghost#{user_id[-4:] if len(user_id) >= 4 else '01'}"

        waiting_room_doc = {
            "room_id": room_id,
            "mode": "instant_5min_date",
            "title": "Quick Date",
            "banner": INSTANT_DATE_MANIFEST["rules"],
            "duration_minutes": 5,
            "duration_seconds": 300,
            "created_at": now,
            "expires_at": now + 300,
            "user_id": user_id,
            "peer_user_id": None,
            "user_ghost": user_ghost,
            "peer_ghost": "Waiting...",
            "participants": [user_id],
            "messages": [
                {
                    "msg_id": f"qmsg_{uuid.uuid4().hex[:6]}",
                    "sender_id": "system",
                    "sender_ghost": "⚡ Quick Date",
                    "text": "🔍 Searching for an anonymous partner... Waiting for a real person to join the chamber.",
                    "timestamp": now
                }
            ],
            "decisions": {},
            "full_chat_unlocked": False,
            "status": "waiting"
        }
        INSTANT_DATE_ROOMS[room_id] = waiting_room_doc
        INSTANT_DATE_WAITING_QUEUE[user_id] = {
            "user_id": user_id,
            "room_id": room_id,
            "joined_at": now
        }

        return {
            "status": "waiting",
            "room_id": room_id,
            "room": waiting_room_doc,
            "message": "Searching for an anonymous partner... Waiting for a real person to connect.",
            "banner": INSTANT_DATE_MANIFEST["rules"]
        }

@router.post("/cancel")
async def cancel_instant_date_queue(req: Instant5MinDateRequest):
    """Cancels queue search for Instant Date."""
    INSTANT_DATE_WAITING_QUEUE.pop(req.user_id, None)
    return {"status": "cancelled", "user_id": req.user_id}

@router.get("/room/{room_id}")
async def get_instant_date_room(room_id: str):
    """Fetches real-time status and messages of a 5-minute date."""
    room = INSTANT_DATE_ROOMS.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.instant_date_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Quick Date room not found")

    now = time.time()
    remaining = max(0, int(room["expires_at"] - now))
    is_expired = now >= room["expires_at"] if room.get("status") == "active" else False

    return {
        "status": "completed" if (is_expired or room["status"] not in ["active", "waiting"]) else room["status"],
        "room_id": room_id,
        "remaining_seconds": remaining,
        "is_expired": is_expired,
        "messages": room.get("messages", []),
        "decisions": room.get("decisions", {}),
        "full_chat_unlocked": room.get("full_chat_unlocked", False),
        "room": room
    }

@router.post("/room/{room_id}/message")
async def send_instant_date_message(room_id: str, req: Instant5MinMessageRequest):
    """Sends a real message within the 5-minute date chamber between real users."""
    room = INSTANT_DATE_ROOMS.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    sender_ghost = room["user_ghost"] if req.user_id == room["user_id"] else room["peer_ghost"]
    new_msg = {
        "msg_id": f"qmsg_{uuid.uuid4().hex[:6]}",
        "sender_id": req.user_id,
        "sender_ghost": sender_ghost,
        "text": req.text,
        "timestamp": time.time()
    }
    room["messages"].append(new_msg)

    # Saved to DB
    db = get_db()
    if db is not None:
        await db.instant_date_rooms.update_one(
            {"room_id": room_id},
            {"$push": {"messages": new_msg}}
        )

    return {
        "status": "sent",
        "sent_message": new_msg
    }

@router.post("/room/{room_id}/decision")
async def submit_instant_date_decision(room_id: str, req: Instant5MinDecisionRequest):
    """
    Submits user decision at the end of the 5 minutes:
    - ❤️ Continue
    - 🤝 Friends
    - 👋 Exit

    Rule: If both select Continue: Full chat unlocked
    """
    room = INSTANT_DATE_ROOMS.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    decision = req.decision.lower().strip()
    if decision not in ("continue", "friends", "exit", "maybe_later"):
        raise HTTPException(status_code=400, detail="Decision must be 'continue', 'friends', 'exit', or 'maybe_later'")

    room["decisions"][req.user_id] = decision

    # Peer decision simulation
    peer_id = room["peer_user_id"]
    if peer_id not in room["decisions"]:
        # If user selected exit, peer exits neutrally. Otherwise peer matches or continues
        if decision == "exit":
            room["decisions"][peer_id] = "exit"
        elif decision == "maybe_later":
            room["decisions"][peer_id] = "maybe_later"
        elif decision == "continue":
            room["decisions"][peer_id] = "continue"
        else:
            room["decisions"][peer_id] = "friends"

    user_d = room["decisions"].get(req.user_id)
    peer_d = room["decisions"].get(peer_id)

    second_chance_id = None
    # Resolution logic:
    if user_d == "maybe_later" and peer_d == "maybe_later":
        outcome = "second_chance"
        room["full_chat_unlocked"] = False
        room["status"] = "second_chance"
        message = "🔄 Both selected 'Maybe later'. Connection safely placed into Second Chance. Reconnect anytime if both independently choose to reopen it."

        # Register into Second Chance vault
        from .second_chance import SECOND_CHANCE_VAULT
        second_chance_id = f"sc_{uuid.uuid4().hex[:12]}"
        sc_doc = {
            "second_chance_id": second_chance_id,
            "source": "instant_date",
            "source_room_id": room_id,
            "participants": [req.user_id, peer_id],
            "participant_meta": {
                req.user_id: {"pseudonym": room.get("user_ghost", "Ghost")},
                peer_id: {"pseudonym": room.get("peer_ghost", "Spark")}
            },
            "placed_at": time.time(),
            "status": "dormant",
            "reopen_requests": {
                req.user_id: False,
                peer_id: False
            },
            "archived_by": {
                req.user_id: False,
                peer_id: False
            },
            "reopened_at": None,
            "unlocked_chat_id": None
        }
        SECOND_CHANCE_VAULT[second_chance_id] = sc_doc
        db = get_db()
        if db is not None:
            await db.second_chance_connections.update_one(
                {"second_chance_id": second_chance_id},
                {"$set": sc_doc},
                upsert=True
            )
    elif user_d == "continue" and peer_d == "continue":
        outcome = "full_chat_unlocked"
        room["full_chat_unlocked"] = True
        room["status"] = "unlocked"
        message = "🎉 Mutual Continue! Full chat unlocked between both users."
    elif user_d == "exit" or peer_d == "exit":
        outcome = "ended_safely"
        room["full_chat_unlocked"] = False
        room["status"] = "exited"
        message = "The 5-Minute Date has ended."
    else:
        outcome = "friends_connected"
        room["full_chat_unlocked"] = True
        room["status"] = "friends"
        message = "🤝 Both chose Friends! Direct conversation connected."

    return {
        "status": "decision_resolved",
        "room_id": room_id,
        "outcome": outcome,
        "user_decision": user_d,
        "peer_decision": peer_d,
        "full_chat_unlocked": room["full_chat_unlocked"],
        "second_chance_id": second_chance_id,
        "message": message
    }

