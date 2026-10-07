import time
import uuid
import logging
from typing import Dict, Optional, List, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..websocket_manager import ws_manager

logger = logging.getLogger("e2ee.blind_photo")
router = APIRouter(prefix="/api/blind-photo", tags=["Blind Photo Reveal"])

# High-quality aesthetic presets for privacy-focused blind photo reveals
PRESET_BLIND_PHOTOS = [
    {
        "id": "preset_sunset_silhouette",
        "title": "Sunset Silhouette",
        "category": "Travel & Nature",
        "full_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "blur_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=100&q=10&blur=50",
        "caption": "Golden hour along the southern coast 🌅"
    },
    {
        "id": "preset_cozy_coffee",
        "title": "Cozy Artisan Coffee",
        "category": "Lifestyle",
        "full_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80",
        "blur_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=100&q=10&blur=50",
        "caption": "My favorite hidden espresso bar in the old quarter ☕"
    },
    {
        "id": "preset_neon_skyline",
        "title": "Neon City Skyline",
        "category": "Nightlife & City",
        "full_url": "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
        "blur_url": "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=100&q=10&blur=50",
        "caption": "Midnight rooftop view under neon rain 🌃"
    },
    {
        "id": "preset_adventure_dog",
        "title": "Trail Companion",
        "category": "Pets & Adventure",
        "full_url": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1200&q=80",
        "blur_url": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=100&q=10&blur=50",
        "caption": "Hiking partner refusing to take another step without snacks 🐾"
    },
    {
        "id": "preset_analog_camera",
        "title": "Vintage Film Camera",
        "category": "Art & Hobbies",
        "full_url": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=80",
        "blur_url": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=100&q=10&blur=50",
        "caption": "35mm camera I found at a thrift market in Kyoto 📷"
    }
]

# In-memory store for Blind Photo Reveal items: photo_id -> Dict
blind_photos_db: Dict[str, Dict[str, Any]] = {}

class CreateBlindPhotoRequest(BaseModel):
    uploader_id: str
    session_id: str  # e.g. "alice:bob"
    full_photo_url: str
    preview_blur_url: Optional[str] = None
    caption: Optional[str] = "Confidential Photo"
    auto_consent_uploader: bool = True

class BlindPhotoConsentRequest(BaseModel):
    photo_id: str
    user_id: str
    consent: bool  # True: agree to reveal, False: decline / keep locked

@router.get("/presets")
async def get_presets():
    """
    Returns curated privacy-friendly blind photo presets.
    """
    return {
        "total": len(PRESET_BLIND_PHOTOS),
        "presets": PRESET_BLIND_PHOTOS
    }

@router.post("/create")
async def create_blind_photo(req: CreateBlindPhotoRequest):
    """
    Creates a new locked blind photo instance.
    Photo remains locked (Photo Locked 🔒) until both session participants mutually agree.
    """
    photo_id = f"bphoto_{uuid.uuid4().hex[:12]}"
    now = time.time()

    # Initial consents
    consents: Dict[str, bool] = {}
    if req.auto_consent_uploader and req.uploader_id:
        consents[req.uploader_id] = True

    blur_url = req.preview_blur_url or req.full_photo_url

    doc = {
        "photo_id": photo_id,
        "uploader_id": req.uploader_id,
        "session_id": req.session_id,
        "full_photo_url": req.full_photo_url,
        "preview_blur_url": blur_url,
        "caption": req.caption or "Confidential Photo",
        "consents": consents,
        "unlocked": False,
        "created_at": now
    }
    blind_photos_db[photo_id] = doc

    return {
        "status": "created",
        "photo_id": photo_id,
        "locked": True,
        "caption": doc["caption"],
        "preview_blur_url": doc["preview_blur_url"],
        "consents": consents,
        "created_at": now
    }

@router.get("/status/{photo_id}")
async def get_blind_photo_status(photo_id: str, user_id: Optional[str] = None):
    """
    Returns current lock & consent status of the blind photo.
    Full photo URL is strictly sealed until both users accept reveal.
    """
    photo = blind_photos_db.get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Blind photo not found")

    session_users = photo["session_id"].split(":") if ":" in photo["session_id"] else []
    my_consent = photo["consents"].get(user_id) if user_id else None

    # Peer consent
    peer_consent = None
    if user_id and len(session_users) == 2:
        peer_id = session_users[0] if session_users[1] == user_id else session_users[1]
        peer_consent = photo["consents"].get(peer_id)

    total_consents = sum(1 for c in photo["consents"].values() if c is True)
    is_unlocked = photo["unlocked"]

    return {
        "photo_id": photo_id,
        "uploader_id": photo["uploader_id"],
        "session_id": photo["session_id"],
        "caption": photo["caption"],
        "locked": not is_unlocked,
        "unlocked": is_unlocked,
        "consents": photo["consents"],
        "total_consents": total_consents,
        "my_consent": my_consent,
        "peer_consent": peer_consent,
        "preview_blur_url": photo["preview_blur_url"],
        "full_photo_url": photo["full_photo_url"] if is_unlocked else None,
        "created_at": photo["created_at"]
    }

@router.post("/consent")
async def submit_consent(req: BlindPhotoConsentRequest):
    """
    Mutual consent agreement:
    Both users must mutually agree:
    - User A: Reveal photo? -> Accept
    - User B: Reveal photo? -> Accept
    If both accept:
    -> 🔓 Photo Unlocked
    Otherwise:
    -> Photo Locked 🔒
    """
    photo = blind_photos_db.get(req.photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Blind photo not found")

    photo["consents"][req.user_id] = req.consent

    session_users = photo["session_id"].split(":") if ":" in photo["session_id"] else []
    
    # Check if both session users agreed
    both_accepted = False
    if len(session_users) >= 2:
        u1, u2 = session_users[0], session_users[1]
        c1 = photo["consents"].get(u1, False)
        c2 = photo["consents"].get(u2, False)
        if c1 and c2:
            both_accepted = True
    elif len(photo["consents"]) >= 2 and all(photo["consents"].values()):
        both_accepted = True

    if not req.consent:
        # If explicitly declined, ensure unlocked is False
        photo["unlocked"] = False
    elif both_accepted:
        photo["unlocked"] = True

    # Real-time WebSocket signal to both users
    for uid in session_users:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_photo.consent_updated",
                "photo_id": req.photo_id,
                "session_id": photo["session_id"],
                "actor_id": req.user_id,
                "consent": req.consent,
                "unlocked": photo["unlocked"],
                "full_photo_url": photo["full_photo_url"] if photo["unlocked"] else None,
                "timestamp": time.time()
            }
        })

    return {
        "status": "updated",
        "photo_id": req.photo_id,
        "user_id": req.user_id,
        "consent": req.consent,
        "unlocked": photo["unlocked"],
        "locked": not photo["unlocked"],
        "total_consents": sum(1 for c in photo["consents"].values() if c is True),
        "full_photo_url": photo["full_photo_url"] if photo["unlocked"] else None
    }

@router.post("/reset")
async def reset_blind_photo(photo_id: str):
    """
    Resets consent status for repeated testing.
    """
    photo = blind_photos_db.get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Blind photo not found")

    photo["consents"] = {photo["uploader_id"]: True}
    photo["unlocked"] = False
    return {"status": "reset", "photo_id": photo_id, "locked": True}
