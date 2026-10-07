import time
import logging
from typing import Dict, Optional, List, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..websocket_manager import ws_manager
from ..database import get_db

logger = logging.getLogger("e2ee.blur_reveal")
router = APIRouter(prefix="/api/blur-profile", tags=["Blur-to-Reveal Profile"])

# The 4 Progressive Blur Stages according to user specification:
# Blur 100% -> Blur 70% -> Blur 40% -> Clear
BLUR_STAGES: List[Dict[str, Any]] = [
    {
        "stage": 0,
        "blur_percent": 100,
        "blur_radius": 30,
        "label": "Blur 100%",
        "title": "Mystery Person",
        "ascii_art": "    ███████\n   █████████\n    ███████",
        "description": "Initial state: heavy veil. Total privacy with zero exposed traits."
    },
    {
        "stage": 1,
        "blur_percent": 70,
        "blur_radius": 18,
        "label": "Blur 70%",
        "title": "Soft Silhouette",
        "ascii_art": "    ░█████░\n   ░███████░\n    ░█████░",
        "description": "70% blur: subtle silhouette contours & ambient color glow emerge."
    },
    {
        "stage": 2,
        "blur_percent": 40,
        "blur_radius": 8,
        "label": "Blur 40%",
        "title": "Ambient Outline",
        "ascii_art": "    ┌─────┐\n   │  ● ●  │\n    └─────┘",
        "description": "40% blur: recognizable posture, hairstyle contours & lighting mood emerge."
    },
    {
        "stage": 3,
        "blur_percent": 0,
        "blur_radius": 0,
        "label": "Clear",
        "title": "Clear Profile",
        "ascii_art": "    ✨ 🌸 ✨\n   ( ^ _ ^ )\n    ✨ 💖 ✨",
        "description": "Clear: 100% crystal-clear profile unblurred by mutual consent."
    }
]

PRIVACY_DISCLAIMER = (
    "Don't use this to infer anything about the person; "
    "it's purely an interface effect controlled by mutual consent."
)

# In-memory store: pair_id -> Dict
blur_sessions: Dict[str, Dict[str, Any]] = {}

def get_canonical_pair_id(u1: str, u2: str) -> str:
    return ":".join(sorted([u1, u2]))

class BlurConsentRequest(BaseModel):
    user_id: str
    peer_id: str
    agree: bool

class BlurStepRequest(BaseModel):
    user_id: str
    peer_id: str
    target_stage: Optional[int] = None

@router.get("/status")
async def get_blur_profile_status(user_id: str = Query(...), peer_id: str = Query(...)):
    """
    Returns the Blur-to-Reveal stage for the conversation between user_id and peer_id.
    Includes the initial ASCII Mystery Person art, current blur percentage, and mutual consent status.
    """
    db = get_db()
    pair_id = get_canonical_pair_id(user_id, peer_id)

    session = blur_sessions.get(pair_id)
    if not session:
        session = {
            "pair_id": pair_id,
            "users": [user_id, peer_id],
            "stage": 0,
            "consents": {user_id: False, peer_id: False},
            "created_at": time.time(),
            "updated_at": time.time()
        }
        blur_sessions[pair_id] = session

    cur_stage = session["stage"]
    stage_data = BLUR_STAGES[cur_stage]

    # Fetch peer basic details if available
    peer_doc = await db.users.find_one({"user_id": peer_id}) if db is not None else None
    peer_profile = (peer_doc or {}).get("profile") or {}
    avatar_color = peer_profile.get("avatar_color", "#818cf8")
    avatar_emoji = peer_profile.get("avatar_emoji", "👤")

    # Photo URL is strictly sealed unless stage is Clear (stage == 3)
    photo_url = peer_profile.get("photo_url") if cur_stage == 3 else None

    # Peer pseudonym or Mystery Person
    display_title = stage_data["title"]
    if cur_stage == 3:
        display_title = peer_doc.get("pseudonym") or "Peer" if peer_doc else "Clear Profile"

    return {
        "pair_id": pair_id,
        "current_stage": cur_stage,
        "blur_percent": stage_data["blur_percent"],
        "blur_radius": stage_data["blur_radius"],
        "stage_label": stage_data["label"],
        "stage_title": display_title,
        "stage_description": stage_data["description"],
        "ascii_art": stage_data["ascii_art"],
        "initial_ascii_art": BLUR_STAGES[0]["ascii_art"],
        "initial_label": "Mystery Person",
        "consents": session["consents"],
        "my_consent": session["consents"].get(user_id, False),
        "peer_consent": session["consents"].get(peer_id, False),
        "privacy_notice": PRIVACY_DISCLAIMER,
        "avatar_color": avatar_color,
        "avatar_emoji": avatar_emoji,
        "photo_url": photo_url,
        "stages": BLUR_STAGES
    }

@router.post("/consent")
async def submit_blur_consent(req: BlurConsentRequest):
    """
    Submits mutual consent to advance the blur level (Blur 100% -> Blur 70% -> Blur 40% -> Clear).
    Requires mutual consent from both users to transition.
    """
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = blur_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "users": [req.user_id, req.peer_id],
        "stage": 0,
        "consents": {req.user_id: False, req.peer_id: False},
        "created_at": time.time(),
        "updated_at": time.time()
    })

    session["consents"][req.user_id] = req.agree

    advanced = False
    u1, u2 = session["users"][0], session["users"][1]
    if session["consents"].get(u1) and session["consents"].get(u2):
        if session["stage"] < 3:
            session["stage"] += 1
            advanced = True
            # Reset consents for the next progression tier
            session["consents"] = {u1: False, u2: False}
            session["updated_at"] = time.time()

    cur_stage = session["stage"]
    stage_data = BLUR_STAGES[cur_stage]

    # Signal both users via WebSocket
    for uid in session["users"]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "blur_profile.stage_updated",
                "pair_id": pair_id,
                "current_stage": cur_stage,
                "blur_percent": stage_data["blur_percent"],
                "stage_label": stage_data["label"],
                "ascii_art": stage_data["ascii_art"],
                "advanced": advanced,
                "timestamp": time.time()
            }
        })

    return {
        "status": "updated",
        "pair_id": pair_id,
        "advanced": advanced,
        "current_stage": cur_stage,
        "blur_percent": stage_data["blur_percent"],
        "stage_label": stage_data["label"],
        "stage_title": stage_data["title"],
        "ascii_art": stage_data["ascii_art"],
        "consents": session["consents"],
        "privacy_notice": PRIVACY_DISCLAIMER
    }

@router.post("/step")
async def step_blur_stage(req: BlurStepRequest):
    """
    Steps to a specific or next blur stage for testing and progressive demonstration.
    """
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = blur_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "users": [req.user_id, req.peer_id],
        "stage": 0,
        "consents": {req.user_id: False, req.peer_id: False},
        "created_at": time.time(),
        "updated_at": time.time()
    })

    if req.target_stage is not None:
        session["stage"] = max(0, min(3, req.target_stage))
    else:
        session["stage"] = min(3, session["stage"] + 1)

    cur_stage = session["stage"]
    stage_data = BLUR_STAGES[cur_stage]
    session["updated_at"] = time.time()

    for uid in session["users"]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "blur_profile.stage_updated",
                "pair_id": pair_id,
                "current_stage": cur_stage,
                "blur_percent": stage_data["blur_percent"],
                "stage_label": stage_data["label"],
                "ascii_art": stage_data["ascii_art"],
                "timestamp": time.time()
            }
        })

    return {
        "status": "stepped",
        "pair_id": pair_id,
        "current_stage": cur_stage,
        "blur_percent": stage_data["blur_percent"],
        "stage_label": stage_data["label"],
        "stage_title": stage_data["title"],
        "ascii_art": stage_data["ascii_art"]
    }

@router.post("/reset")
async def reset_blur_profile(user_id: str = Query(...), peer_id: str = Query(...)):
    """
    Resets the pair's blur level back to Blur 100% (Mystery Person).
    """
    pair_id = get_canonical_pair_id(user_id, peer_id)
    session = {
        "pair_id": pair_id,
        "users": [user_id, peer_id],
        "stage": 0,
        "consents": {user_id: False, peer_id: False},
        "created_at": time.time(),
        "updated_at": time.time()
    }
    blur_sessions[pair_id] = session

    for uid in [user_id, peer_id]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "blur_profile.stage_updated",
                "pair_id": pair_id,
                "current_stage": 0,
                "blur_percent": 100,
                "stage_label": "Blur 100%",
                "ascii_art": BLUR_STAGES[0]["ascii_art"],
                "timestamp": time.time()
            }
        })

    return {
        "status": "reset",
        "pair_id": pair_id,
        "current_stage": 0,
        "blur_percent": 100,
        "stage_label": "Blur 100%",
        "title": "Mystery Person"
    }
