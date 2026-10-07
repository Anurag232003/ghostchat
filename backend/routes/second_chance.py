import uuid
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..websocket_manager import ws_manager
from ..models import (
    SecondChancePlaceRequest,
    SecondChanceReopenRequest,
    SecondChanceArchiveRequest
)

router = APIRouter(prefix="/api/second-chance", tags=["Second Chance"])

SECOND_CHANCE_VAULT: Dict[str, Dict[str, Any]] = {}

SECOND_CHANCE_MANIFEST = {
    "feature": "🔄 Second Chance",
    "trigger": "If both users select: Maybe later",
    "placement": "Second Chance",
    "reconnect_rule": "They can reconnect later if both independently choose to reopen it.",
    "privacy_policy": "Zero pressure and zero rejection alerts. Neither party is informed whether the other has reopened until both independently choose to reconnect."
}

@router.get("/manifest")
async def get_second_chance_manifest():
    """Returns the Second Chance architecture manifest and rules."""
    return {
        "status": "success",
        "manifest": SECOND_CHANCE_MANIFEST
    }

@router.get("/list")
async def get_second_chance_list(user_id: str = Query(..., description="Current user ID")):
    """
    Returns all connections in 'Second Chance' for the user.
    Hides peer's individual vote until both have mutually reopened.
    """
    db = get_db()
    connections = []

    # Check in-memory vault first
    for sc_id, entry in SECOND_CHANCE_VAULT.items():
        if user_id in entry.get("participants", []) and not entry.get("archived_by", {}).get(user_id, False):
            connections.append(entry)

    # Check MongoDB
    if db is not None:
        cursor = db.second_chance_connections.find({
            "participants": user_id,
            f"archived_by.{user_id}": {"$ne": True}
        })
        async for doc in cursor:
            doc.pop("_id", None)
            if doc["second_chance_id"] not in [c["second_chance_id"] for c in connections]:
                connections.append(doc)
                SECOND_CHANCE_VAULT[doc["second_chance_id"]] = doc

    # Prepare user-safe sanitized projection
    results = []
    for conn in connections:
        participants = conn.get("participants", [])
        peer_id = next((p for p in participants if p != user_id), None)
        peer_meta = conn.get("participant_meta", {}).get(peer_id, {})
        peer_name = peer_meta.get("pseudonym") or f"Anonymous Partner #{peer_id[-4:] if peer_id else '00'}"

        my_reopened = conn.get("reopen_requests", {}).get(user_id, False)
        is_reconnected = conn.get("status") == "reopened"

        results.append({
            "second_chance_id": conn["second_chance_id"],
            "peer_id": peer_id,
            "peer_name": peer_name,
            "source": conn.get("source", "blind_date"),
            "placed_at": conn.get("placed_at", time.time()),
            "status": conn.get("status", "dormant"),
            "my_reopen_status": my_reopened,
            "is_reconnected": is_reconnected,
            "reopened_at": conn.get("reopened_at"),
            "unlocked_chat_id": conn.get("unlocked_chat_id")
        })

    # Sort newest first
    results.sort(key=lambda x: x["placed_at"], reverse=True)

    return {
        "status": "success",
        "total": len(results),
        "connections": results,
        "manifest": SECOND_CHANCE_MANIFEST
    }

@router.post("/place")
async def place_in_second_chance(req: SecondChancePlaceRequest):
    """
    Places a connection into Second Chance when both selected 'Maybe later'.
    """
    now = time.time()
    db = get_db()

    # Check if a second chance record already exists between these users
    existing_id = None
    for sc_id, entry in SECOND_CHANCE_VAULT.items():
        if set(entry.get("participants", [])) == {req.user_id, req.peer_id}:
            existing_id = sc_id
            break

    if not existing_id and db is not None:
        existing = await db.second_chance_connections.find_one({
            "participants": {"$all": [req.user_id, req.peer_id]}
        })
        if existing:
            existing_id = existing["second_chance_id"]

    sc_id = existing_id or f"sc_{uuid.uuid4().hex[:12]}"
    peer_name = req.peer_pseudonym or f"Anonymous Partner #{req.peer_id[-4:]}"

    doc = {
        "second_chance_id": sc_id,
        "source": req.source,
        "source_room_id": req.source_room_id,
        "participants": [req.user_id, req.peer_id],
        "participant_meta": {
            req.user_id: {"pseudonym": f"User #{req.user_id[-4:]}"},
            req.peer_id: {"pseudonym": peer_name}
        },
        "placed_at": now,
        "status": "dormant",
        "reopen_requests": {
            req.user_id: False,
            req.peer_id: False
        },
        "archived_by": {
            req.user_id: False,
            req.peer_id: False
        },
        "reopened_at": None,
        "unlocked_chat_id": None
    }

    SECOND_CHANCE_VAULT[sc_id] = doc

    if db is not None:
        await db.second_chance_connections.update_one(
            {"second_chance_id": sc_id},
            {"$set": doc},
            upsert=True
        )

    return {
        "status": "placed",
        "second_chance_id": sc_id,
        "message": "Connection placed into Second Chance. Reconnect anytime if both independently choose to reopen it.",
        "connection": doc
    }

@router.post("/reopen")
async def reopen_second_chance_connection(req: SecondChanceReopenRequest):
    """
    User independently chooses to reopen the connection.
    Rule: 'They can reconnect later if both independently choose to reopen it.'
    """
    sc_id = req.second_chance_id
    entry = SECOND_CHANCE_VAULT.get(sc_id)
    db = get_db()

    if not entry and db is not None:
        entry = await db.second_chance_connections.find_one({"second_chance_id": sc_id})
        if entry:
            entry.pop("_id", None)
            SECOND_CHANCE_VAULT[sc_id] = entry

    if not entry:
        raise HTTPException(status_code=404, detail="Second Chance connection not found")

    participants = entry.get("participants", [])
    if req.user_id not in participants:
        raise HTTPException(status_code=403, detail="User is not part of this connection")

    peer_id = next((p for p in participants if p != req.user_id), None)

    # Mark user's independent reopen choice
    entry.setdefault("reopen_requests", {})[req.user_id] = True

    # If demo simulation requested, mark peer as also reopening
    if req.simulate_peer_reopen and peer_id:
        entry["reopen_requests"][peer_id] = True

    # Check if both have independently chosen to reopen
    user_reopen = entry["reopen_requests"].get(req.user_id, False)
    peer_reopen = entry["reopen_requests"].get(peer_id, False) if peer_id else False

    both_reopened = user_reopen and peer_reopen

    if both_reopened:
        entry["status"] = "reopened"
        entry["reopened_at"] = time.time()
        entry["unlocked_chat_id"] = f"reconnect_{uuid.uuid4().hex[:8]}"

        # Persist unlock in identity_unlocks if DB available
        if db is not None and peer_id:
            await db.identity_unlocks.update_one(
                {"granter_id": req.user_id, "grantee_id": peer_id},
                {"$set": {"granter_id": req.user_id, "grantee_id": peer_id, "level": 2, "updated_at": time.time()}},
                upsert=True
            )
            await db.identity_unlocks.update_one(
                {"granter_id": peer_id, "grantee_id": req.user_id},
                {"$set": {"granter_id": peer_id, "grantee_id": req.user_id, "level": 2, "updated_at": time.time()}},
                upsert=True
            )

        # Notify via WebSocket if active
        for p in participants:
            await ws_manager.send_to_user(p, {
                "type": "signal",
                "signal": {
                    "signal_type": "second_chance.reconnected",
                    "second_chance_id": sc_id,
                    "reconnected": True,
                    "peer_id": peer_id if p == req.user_id else req.user_id,
                    "timestamp": time.time()
                }
            })

        outcome = "mutual_reopen_achieved"
        message = "🎉 Mutual Reopen! Both users independently chose to reconnect. Full chat is now unlocked!"
    else:
        outcome = "waiting_mutual_reopen"
        message = "🔄 You chose to reopen this connection! If your match also independently chooses to reopen it, your connection will instantly unlock."

    SECOND_CHANCE_VAULT[sc_id] = entry

    if db is not None:
        await db.second_chance_connections.update_one(
            {"second_chance_id": sc_id},
            {"$set": {
                "status": entry["status"],
                "reopen_requests": entry["reopen_requests"],
                "reopened_at": entry["reopened_at"],
                "unlocked_chat_id": entry["unlocked_chat_id"]
            }}
        )

    return {
        "status": "success",
        "second_chance_id": sc_id,
        "outcome": outcome,
        "is_reconnected": both_reopened,
        "my_reopen_status": True,
        "message": message,
        "unlocked_chat_id": entry.get("unlocked_chat_id")
    }

@router.post("/archive")
async def archive_second_chance(req: SecondChanceArchiveRequest):
    """Allows a user to quietly hide a Second Chance connection from their view."""
    sc_id = req.second_chance_id
    entry = SECOND_CHANCE_VAULT.get(sc_id)
    db = get_db()

    if not entry and db is not None:
        entry = await db.second_chance_connections.find_one({"second_chance_id": sc_id})
        if entry:
            entry.pop("_id", None)
            SECOND_CHANCE_VAULT[sc_id] = entry

    if not entry:
        raise HTTPException(status_code=404, detail="Second Chance connection not found")

    entry.setdefault("archived_by", {})[req.user_id] = True
    SECOND_CHANCE_VAULT[sc_id] = entry

    if db is not None:
        await db.second_chance_connections.update_one(
            {"second_chance_id": sc_id},
            {"$set": {f"archived_by.{req.user_id}": True}}
        )

    return {
        "status": "success",
        "second_chance_id": sc_id,
        "message": "Connection archived from your Second Chance vault."
    }
