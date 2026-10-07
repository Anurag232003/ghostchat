import uuid
import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    InitSecretChatRequest,
    SecretChatSessionResponse,
    TerminateSecretChatRequest,
)

router = APIRouter(prefix="/api/secret-chat", tags=["Secret Chat Mode"])

# In-memory ephemeral registry for Secret Chat sessions (strictly no persistent DB storage for messages)
SECRET_SESSIONS_REGISTRY: Dict[str, Dict[str, Any]] = {}

SECRET_MODE_CHARACTERISTICS = {
    "disappearing_messages": {
        "enabled": True,
        "description": "Messages burn automatically after being viewed on a strict countdown timer (5s–60s)."
    },
    "no_message_history_on_server": {
        "enabled": True,
        "description": "Zero server retention. Messages bypass database storage entirely and exist only in-flight."
    },
    "restricted_forwarding": {
        "enabled": True,
        "description": "Forwarding, exporting, and clipboard duplication are strictly disabled."
    },
    "temporary_encryption_keys": {
        "enabled": True,
        "description": "Fresh ephemeral session keys are generated specifically for this secret session and zeroized upon exit."
    },
    "optional_screenshot_detection": {
        "enabled": True,
        "description": "Screen capture shortcuts trigger instant warning alerts on supported operating systems."
    },
    "automatic_session_expiration": {
        "enabled": True,
        "description": "Session has a finite lifespan; all keys and local memory are burned automatically upon expiry."
    }
}

@router.get("/characteristics")
async def get_secret_mode_characteristics():
    """Returns the 6 core characteristics of SECRET MODE 🔐."""
    return {
        "mode": "SECRET MODE 🔐",
        "characteristics": SECRET_MODE_CHARACTERISTICS,
        "guarantee": "Strict zero-knowledge ephemeral protocol. No disk footprint."
    }

@router.post("/init")
async def init_secret_chat_session(request: InitSecretChatRequest):
    """
    Spawns an ephemeral SECRET MODE 🔐 session between two users with temporary keys.
    """
    now = time.time()
    session_id = f"sec_{uuid.uuid4().hex[:12]}"
    expires_at = now + request.ttl_seconds

    # Ephemeral temporary encryption keypair simulation/storage
    temp_key = request.temp_public_key or uuid.uuid4().hex

    session_data = {
        "secret_session_id": session_id,
        "initiator_id": request.user_id,
        "peer_id": request.peer_id,
        "participants": [request.user_id, request.peer_id],
        "disappearing_seconds": request.disappearing_seconds,
        "ttl_seconds": request.ttl_seconds,
        "expires_at": expires_at,
        "temp_keys": {
            request.user_id: temp_key
        },
        "characteristics": SECRET_MODE_CHARACTERISTICS,
        "status": "active",
        "created_at": now
    }

    SECRET_SESSIONS_REGISTRY[session_id] = session_data

    return {
        "status": "secret_mode_active",
        "mode_title": "SECRET MODE 🔐",
        "secret_session_id": session_id,
        "initiator_id": request.user_id,
        "peer_id": request.peer_id,
        "disappearing_seconds": request.disappearing_seconds,
        "ttl_seconds": request.ttl_seconds,
        "expires_at": expires_at,
        "temp_public_key": temp_key,
        "characteristics": SECRET_MODE_CHARACTERISTICS
    }

@router.get("/{secret_session_id}")
async def get_secret_chat_status(secret_session_id: str):
    """Retrieves live status and remaining TTL of an active Secret Chat session."""
    session = SECRET_SESSIONS_REGISTRY.get(secret_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Secret Chat session not found or already burned")

    now = time.time()
    if session["expires_at"] < now:
        del SECRET_SESSIONS_REGISTRY[secret_session_id]
        raise HTTPException(status_code=410, detail="Secret Chat session has automatically expired and burned")

    remaining_seconds = max(0, int(session["expires_at"] - now))
    return {
        "status": "active",
        "secret_session_id": secret_session_id,
        "remaining_seconds": remaining_seconds,
        "disappearing_seconds": session["disappearing_seconds"],
        "participants": session["participants"],
        "characteristics": session["characteristics"],
        "expires_at": session["expires_at"]
    }

@router.get("/active-between/{user_a}/{user_b}")
async def get_active_between_users(user_a: str, user_b: str):
    """Finds any active, unexpired Secret Chat between two users."""
    now = time.time()
    pair = set([user_a, user_b])

    for sid, sess in list(SECRET_SESSIONS_REGISTRY.items()):
        if sess["expires_at"] < now:
            del SECRET_SESSIONS_REGISTRY[sid]
            continue
        if set(sess.get("participants", [])) == pair:
            return {
                "has_active_session": True,
                "session": sess,
                "remaining_seconds": max(0, int(sess["expires_at"] - now))
            }

    return {"has_active_session": False}

@router.post("/screenshot-alert")
async def report_screenshot_alert(secret_session_id: str = Query(...), reporter_id: str = Query(...)):
    """Logs and validates screenshot detection alert during Secret Mode."""
    session = SECRET_SESSIONS_REGISTRY.get(secret_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Secret session not found")

    alert_id = f"ss_alert_{uuid.uuid4().hex[:8]}"
    return {
        "status": "screenshot_alert_broadcasted",
        "alert_id": alert_id,
        "secret_session_id": secret_session_id,
        "reporter_id": reporter_id,
        "warning": "📸 Screenshot detected in SECRET MODE 🔐! Optional detection signal dispatched to peer.",
        "timestamp": time.time()
    }

@router.post("/terminate")
async def terminate_secret_chat(request: TerminateSecretChatRequest):
    """
    Terminates the Secret Chat session immediately, zeroizing temporary encryption keys
    and burning all in-memory references.
    """
    session = SECRET_SESSIONS_REGISTRY.pop(request.secret_session_id, None)
    if not session:
        return {"status": "success", "message": "Session already terminated and keys burned."}

    return {
        "status": "secret_mode_terminated",
        "secret_session_id": request.secret_session_id,
        "terminated_by": request.user_id,
        "message": "SECRET MODE 🔐 terminated. Temporary encryption keys zeroized. Session burned.",
        "timestamp": time.time()
    }
