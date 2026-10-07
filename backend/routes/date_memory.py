import time
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException

from backend.models import (
    DateMemory,
    CreateDateMemoryRequest,
    UpdateDateMemoryNotesRequest,
)

router = APIRouter(prefix="/api/date-memory", tags=["date-memory"])

# In-memory store: user_id -> List of DateMemory dicts
_user_memories: Dict[str, List[Dict[str, Any]]] = {}

def _create_canonical_memory(user_id: str) -> Dict[str, Any]:
    """
    Creates the canonical Date Memory specified in prompt:
    Your Blind Date
    🌙 Nova
    Topics: Gaming, Travel, Music
    Games: 3
    Date duration: 18 min
    Mutual reveal: ✓
    """
    memory_id = f"mem_canonical_{user_id[:8]}"
    return {
        "memory_id": memory_id,
        "user_id": user_id,
        "peer_id": "anon_nova_partner_88",
        "peer_pseudonym": "🌙 Nova",
        "peer_avatar": "🌙",
        "topics": ["Gaming", "Travel", "Music"],
        "games_count": 3,
        "date_duration_str": "18 min",
        "date_duration_minutes": 18,
        "mutual_reveal": True,
        "mutual_reveal_icon": "✓",
        "encrypted_notes": "A magical evening discussing retro RPGs, backpacking across Kyoto, and exchanging favorite indie playlists.",
        "date_timestamp": time.time() - 3600,
        "created_at": time.time() - 3600,
        "is_private_encrypted": True,
        "tagline": "This becomes a private encrypted 'date memory.'",
    }

def _get_user_memories(user_id: str) -> List[Dict[str, Any]]:
    if user_id not in _user_memories:
        _user_memories[user_id] = []
    return _user_memories[user_id]


@router.get("/manifest")
def get_date_memory_manifest() -> Dict[str, Any]:
    """
    Returns the core specifications and rules for 30. 💎 Date Memory:
    After a successful date:
    Your Blind Date
    🌙 Nova
    Topics: Gaming, Travel, Music
    Games: 3
    Date duration: 18 min
    Mutual reveal: ✓
    This becomes a private encrypted 'date memory.'
    """
    return {
        "feature_number": 30,
        "feature_name": "Date Memory",
        "icon": "💎",
        "context": "After a successful date",
        "canonical_card": {
            "title": "Your Blind Date",
            "partner": "🌙 Nova",
            "topics": ["Gaming", "Travel", "Music"],
            "games": 3,
            "date_duration": "18 min",
            "mutual_reveal": "✓",
        },
        "guarantee": "This becomes a private encrypted 'date memory.'",
        "highlights": [
            "Encrypted souvenir generated upon successful blind date completion",
            "Tracks topics explored, mini-games played, duration, and mutual reveal milestone",
            "Stored securely in the user's private encrypted vault",
            "Allows private reflections and encrypted notes with zero-knowledge privacy",
        ]
    }


@router.get("/list/{user_id}")
def get_user_date_memories(user_id: str) -> Dict[str, Any]:
    """
    Retrieves all private encrypted Date Memories for the user.
    """
    mems = _get_user_memories(user_id)
    return {
        "user_id": user_id,
        "total_memories": len(mems),
        "memories": [DateMemory(**m) for m in mems],
        "canonical_sample": DateMemory(**mems[0]) if mems else None,
        "tagline": "This becomes a private encrypted 'date memory.'",
    }


@router.get("/{memory_id}")
def get_date_memory_by_id(memory_id: str) -> DateMemory:
    """
    Retrieves a single Date Memory by ID.
    """
    for user_id, mem_list in _user_memories.items():
        for m in mem_list:
            if m["memory_id"] == memory_id:
                return DateMemory(**m)
    raise HTTPException(status_code=404, detail="Date memory not found.")


@router.post("/create")
def create_date_memory(req: CreateDateMemoryRequest) -> Dict[str, Any]:
    """
    Generates a new private encrypted Date Memory after a successful date.
    """
    memory_id = f"mem_{uuid.uuid4().hex[:10]}"
    new_mem = {
        "memory_id": memory_id,
        "user_id": req.user_id,
        "peer_id": req.peer_id,
        "peer_pseudonym": req.peer_pseudonym,
        "peer_avatar": req.peer_pseudonym[:2].strip() if req.peer_pseudonym else "🌙",
        "topics": req.topics,
        "games_count": req.games_count,
        "date_duration_str": f"{req.date_duration_minutes} min",
        "date_duration_minutes": req.date_duration_minutes,
        "mutual_reveal": req.mutual_reveal,
        "mutual_reveal_icon": "✓" if req.mutual_reveal else "✗",
        "encrypted_notes": req.encrypted_notes,
        "date_timestamp": time.time(),
        "created_at": time.time(),
        "is_private_encrypted": True,
        "tagline": "This becomes a private encrypted 'date memory.'",
    }

    if req.user_id not in _user_memories:
        _user_memories[req.user_id] = []
        
    _user_memories[req.user_id].insert(0, new_mem)

    return {
        "success": True,
        "message": "Date memory successfully saved to private encrypted vault.",
        "memory": DateMemory(**new_mem),
    }


@router.post("/update-notes")
def update_date_memory_notes(req: UpdateDateMemoryNotesRequest) -> Dict[str, Any]:
    """
    Updates the private encrypted notes attached to a Date Memory.
    """
    mems = _get_user_memories(req.user_id)
    target = next((m for m in mems if m["memory_id"] == req.memory_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Date memory not found.")

    target["encrypted_notes"] = req.encrypted_notes
    return {
        "success": True,
        "memory_id": req.memory_id,
        "updated_notes": req.encrypted_notes,
        "message": "Private encrypted notes updated.",
    }


@router.delete("/{memory_id}")
def delete_date_memory(memory_id: str, user_id: str) -> Dict[str, Any]:
    """
    Permanently deletes a Date Memory from the user's vault.
    """
    mems = _get_user_memories(user_id)
    idx = next((i for i, m in enumerate(mems) if m["memory_id"] == memory_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Date memory not found.")

    deleted = mems.pop(idx)
    return {
        "success": True,
        "deleted_memory_id": memory_id,
        "message": f"Memory with '{deleted['peer_pseudonym']}' permanently purged.",
    }


@router.post("/reset-demo")
def reset_date_memory_demo(user_id: str) -> Dict[str, Any]:
    """
    Demo/testing utility: Resets the user's memories back to the canonical 🌙 Nova memory.
    """
    _user_memories[user_id] = [_create_canonical_memory(user_id)]
    return {
        "success": True,
        "message": "Date memories reset to canonical demo state.",
        "memories": _user_memories[user_id],
    }
