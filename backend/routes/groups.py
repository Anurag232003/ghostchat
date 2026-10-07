import uuid
import time
from typing import List
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import CreateGroupRequest, GroupResponse

router = APIRouter(prefix="/api/groups", tags=["Encrypted Groups"])

@router.post("/create")
async def create_group(request: CreateGroupRequest, creator_id: str = Query(...)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    group_id = f"grp_{uuid.uuid4().hex[:12]}"
    now = time.time()

    all_members = list(set([creator_id] + request.member_ids))
    members_data = [{"user_id": uid, "role": "admin" if uid == creator_id else "member", "joined_at": now} for uid in all_members]

    group_doc = {
        "group_id": group_id,
        "name": request.name,
        "created_by": creator_id,
        "members": members_data,
        "member_ids": all_members,
        "encrypted_meta": request.encrypted_meta,
        "created_at": now
    }

    await db.groups.insert_one(group_doc)

    # Store encrypted sender keys for each member
    if request.encrypted_sender_keys:
        for member_id, key_packet in request.encrypted_sender_keys.items():
            await db.group_sender_keys.update_one(
                {"group_id": group_id, "recipient_id": member_id},
                {"$set": {
                    "group_id": group_id,
                    "recipient_id": member_id,
                    "sender_id": creator_id,
                    "key_packet": key_packet,
                    "created_at": now
                }},
                upsert=True
            )

    return {
        "status": "success",
        "group_id": group_id,
        "name": request.name,
        "members": members_data
    }

@router.get("/my-groups")
async def get_my_groups(user_id: str):
    db = get_db()
    if db is None:
        return []

    cursor = db.groups.find({"member_ids": user_id}).sort("created_at", -1)
    groups = await cursor.to_list(length=100)

    result = []
    for g in groups:
        result.append({
            "group_id": g["group_id"],
            "name": g["name"],
            "created_by": g["created_by"],
            "members": g.get("members", []),
            "created_at": g.get("created_at", 0),
            "encrypted_meta": g.get("encrypted_meta")
        })
    return result

@router.get("/{group_id}/keys/{user_id}")
async def get_group_sender_key(group_id: str, user_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    key_doc = await db.group_sender_keys.find_one({"group_id": group_id, "recipient_id": user_id})
    if not key_doc:
        raise HTTPException(status_code=404, detail="No sender key distribution found for this user")

    return {
        "group_id": group_id,
        "sender_id": key_doc["sender_id"],
        "key_packet": key_doc["key_packet"]
    }
