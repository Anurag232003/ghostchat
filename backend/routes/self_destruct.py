import time
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    SelfDestructPolicyRequest,
    SelfDestructPolicyResponse,
    BurnConversationRequest,
)

router = APIRouter(prefix="/api/self-destruct", tags=["Self-Destruct Conversations"])

E2EE_DISCLAIMER = "For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."
TRANSPARENCY_NOTE = (
    "While End-to-End Encryption and automated self-destruction purge cryptographic ciphertexts, "
    "local caches, and blind server queues, no software can prevent a recipient from taking a physical photo "
    "of their screen with a secondary device, using OS-level clipboard loggers, or transcribing content."
)

# Standardized self-destruct options as requested by user:
# 5 minutes, 1 hour, 24 hours, 7 days, Never
SELF_DESTRUCT_OPTIONS = [
    {
        "id": "5m",
        "seconds": 300,
        "label": "5 minutes",
        "badge": "⚡ 5m",
        "description": "Messages self-destruct 5 minutes after transmission."
    },
    {
        "id": "1h",
        "seconds": 3600,
        "label": "1 hour",
        "badge": "⏱️ 1h",
        "description": "Messages self-destruct 1 hour after transmission."
    },
    {
        "id": "24h",
        "seconds": 86400,
        "label": "24 hours",
        "badge": "🌙 24h",
        "description": "Messages self-destruct 24 hours after transmission."
    },
    {
        "id": "7d",
        "seconds": 604800,
        "label": "7 days",
        "badge": "📅 7d",
        "description": "Messages self-destruct 7 days after transmission."
    },
    {
        "id": "never",
        "seconds": None,
        "label": "Never",
        "badge": "♾️ Never",
        "description": "Messages persist in encrypted chat until manually deleted."
    }
]

# In-memory registry fallback for policies
IN_MEMORY_POLICIES: Dict[str, Dict[str, Any]] = {}

@router.get("/options")
async def get_self_destruct_options():
    """
    Returns the supported conversation self-destruct intervals and transparency disclaimer:
    - 5 minutes (300s)
    - 1 hour (3600s)
    - 24 hours (86400s)
    - 7 days (604800s)
    - Never
    """
    return {
        "options": SELF_DESTRUCT_OPTIONS,
        "e2ee_disclaimer": E2EE_DISCLAIMER,
        "transparency_notice": TRANSPARENCY_NOTE
    }

@router.get("/policy/{conversation_id}")
async def get_conversation_policy(conversation_id: str):
    """Retrieves the active self-destruct policy for a conversation."""
    db = get_db()
    policy_doc = None
    if db is not None:
        policy_doc = await db.conversation_policies.find_one({"conversation_id": conversation_id})

    if not policy_doc:
        policy_doc = IN_MEMORY_POLICIES.get(conversation_id, {
            "conversation_id": conversation_id,
            "delete_after_seconds": None,
            "retention_label": "Never",
            "updated_at": time.time(),
            "updated_by": None
        })

    return {
        "status": "success",
        "conversation_id": conversation_id,
        "delete_after_seconds": policy_doc.get("delete_after_seconds"),
        "retention_label": policy_doc.get("retention_label", "Never"),
        "updated_at": policy_doc.get("updated_at", time.time()),
        "updated_by": policy_doc.get("updated_by"),
        "e2ee_disclaimer": E2EE_DISCLAIMER
    }

@router.post("/policy")
async def set_conversation_policy(request: SelfDestructPolicyRequest):
    """
    Sets or updates the self-destruct retention policy for a conversation.
    Immediately purges any existing messages older than the new retention threshold.
    """
    now = time.time()
    db = get_db()

    # Normalize label
    seconds_to_label = {
        300: "5 minutes",
        3600: "1 hour",
        86400: "24 hours",
        604800: "7 days",
        None: "Never",
        0: "Never"
    }
    retention_label = request.retention_label or seconds_to_label.get(request.delete_after_seconds, "Custom")
    delete_after_sec = request.delete_after_seconds if request.delete_after_seconds and request.delete_after_seconds > 0 else None

    policy_data = {
        "conversation_id": request.conversation_id,
        "delete_after_seconds": delete_after_sec,
        "retention_label": retention_label,
        "updated_at": now,
        "updated_by": request.user_id,
        "e2ee_disclaimer": E2EE_DISCLAIMER
    }

    IN_MEMORY_POLICIES[request.conversation_id] = policy_data

    purged_count = 0
    if db is not None:
        await db.conversation_policies.update_one(
            {"conversation_id": request.conversation_id},
            {"$set": policy_data},
            upsert=True
        )

        # If a finite retention window is set, purge messages created before (now - delete_after_sec)
        if delete_after_sec is not None:
            cutoff_time = now - delete_after_sec
            purge_result = await db.messages.delete_many({
                "conversation_id": request.conversation_id,
                "created_at": {"$lt": cutoff_time}
            })
            purged_count = purge_result.deleted_count

    return {
        "status": "policy_updated",
        "conversation_id": request.conversation_id,
        "delete_after_seconds": delete_after_sec,
        "retention_label": retention_label,
        "purged_messages_count": purged_count,
        "updated_at": now,
        "e2ee_disclaimer": E2EE_DISCLAIMER,
        "transparency_notice": TRANSPARENCY_NOTE
    }

@router.post("/burn-now")
async def burn_entire_conversation(request: BurnConversationRequest):
    """
    Immediately self-destructs ALL messages, ciphertexts, and ephemeral data in the conversation.
    """
    db = get_db()
    deleted_count = 0

    if db is not None:
        res = await db.messages.delete_many({"conversation_id": request.conversation_id})
        deleted_count = res.deleted_count

    return {
        "status": "conversation_burned",
        "conversation_id": request.conversation_id,
        "burned_by": request.user_id,
        "messages_burned": deleted_count,
        "timestamp": time.time(),
        "notice": "All conversation messages and ciphertexts have been permanently purged from server blind relays.",
        "e2ee_disclaimer": E2EE_DISCLAIMER
    }
