import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import EncryptedMessagePacket

router = APIRouter(prefix="/api/messages", tags=["Encrypted Messages"])

@router.get("/history")
async def get_history(conversation_id: str, limit: int = Query(100, le=200)):
    db = get_db()
    if db is None:
        return []

    now = time.time()

    # Automatically purge expired ephemeral messages
    await db.messages.delete_many({
        "conversation_id": conversation_id,
        "expires_at": {"$ne": None, "$lt": now}
    })

    # Check and enforce conversation-level self-destruct retention policy
    policy_doc = await db.conversation_policies.find_one({"conversation_id": conversation_id})
    if policy_doc and policy_doc.get("delete_after_seconds"):
        cutoff = now - policy_doc["delete_after_seconds"]
        await db.messages.delete_many({
            "conversation_id": conversation_id,
            "created_at": {"$lt": cutoff}
        })

    cursor = db.messages.find({
        "conversation_id": conversation_id,
        "is_deleted": {"$ne": True}
    }).sort("created_at", 1).limit(limit)

    messages = await cursor.to_list(length=limit)

    # Format into response
    results = []
    for m in messages:
        results.append({
            "message_id": m["message_id"],
            "conversation_id": m["conversation_id"],
            "sender_id": m["sender_id"],
            "recipient_id": m.get("recipient_id"),
            "group_id": m.get("group_id"),
            "ciphertext": m["ciphertext"],
            "ratchet_header": m.get("ratchet_header", {}),
            "iv_or_nonce": m.get("iv_or_nonce", ""),
            "ephemeral_timer": m.get("ephemeral_timer"),
            "expires_at": m.get("expires_at"),
            "no_forward": m.get("no_forward", False),
            "reply_to_id": m.get("reply_to_id"),
            "is_delivered": m.get("is_delivered", False),
            "is_read": m.get("is_read", False),
            "created_at": m["created_at"],
            "edit_version": m.get("edit_version", 0)
        })
    return results

@router.post("/delete")
async def delete_message(message_id: str, user_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    msg = await db.messages.find_one({"message_id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the sender can delete this message for everyone")

    await db.messages.update_one(
        {"message_id": message_id},
        {"$set": {"is_deleted": True, "deleted_at": time.time(), "ciphertext": "[DELETED]"}}
    )
    return {"status": "success", "message_id": message_id}
