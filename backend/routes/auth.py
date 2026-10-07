import uuid
import time
from fastapi import APIRouter, HTTPException, Depends
from ..database import get_db
from ..models import UserRegisterRequest, UserProfileResponse, UpdateProfileRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register")
async def register_user(request: UserRegisterRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    # Check if pseudonym already taken
    existing = await db.users.find_one({"pseudonym": request.pseudonym})
    if existing:
        # If the user already registered with the same identity key, return existing
        if existing.get("ed25519_identity_pub") == request.ed25519_identity_pub:
            return {
                "status": "success",
                "user_id": existing["user_id"],
                "pseudonym": existing["pseudonym"],
                "ed25519_identity_pub": existing["ed25519_identity_pub"],
                "message": "Welcome back!"
            }
        raise HTTPException(status_code=400, detail="Pseudonym already taken. Choose another secret handle.")

    user_id = f"anon_{uuid.uuid4().hex[:12]}"
    now = time.time()

    profile_data = request.profile.model_dump() if request.profile else {
        "ghost_id": f"Shadow#{user_id[-4:]}",
        "nickname": request.pseudonym,
        "avatar_emoji": "👤",
        "avatar_color": "#6366F1",
        "age": None,
        "interests": [],
        "vibe": "",
        "first_name": None,
        "photo_url": None,
        "socials": {},
        "location_sharing_enabled": False,
        "approximate_region": None,
        "approximate_distance_km": None
    }

    user_doc = {
        "user_id": user_id,
        "pseudonym": request.pseudonym,
        "ed25519_identity_pub": request.ed25519_identity_pub,
        "x25519_signed_prekey": request.x25519_signed_prekey,
        "signed_prekey_sig": request.signed_prekey_sig,
        "one_time_prekeys": request.one_time_prekeys,
        "profile": profile_data,
        "created_at": now,
        "last_seen": now,
        "is_online": True
    }

    await db.users.insert_one(user_doc)

    return {
        "status": "success",
        "user_id": user_id,
        "pseudonym": request.pseudonym,
        "ed25519_identity_pub": request.ed25519_identity_pub,
        "profile": profile_data,
        "message": "Pseudonymous E2EE Identity established securely."
    }

@router.put("/profile/{user_id}")
async def update_profile(user_id: str, request: UpdateProfileRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"profile": request.profile.model_dump()}}
    )
    return {"status": "success", "profile": request.profile}

@router.get("/profile/{user_id}", response_model=UserProfileResponse)
async def get_profile(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfileResponse(
        user_id=user["user_id"],
        pseudonym=user["pseudonym"],
        ed25519_identity_pub=user["ed25519_identity_pub"],
        created_at=user.get("created_at", 0),
        is_online=user.get("is_online", False),
        last_seen=user.get("last_seen", 0),
        profile=user.get("profile")
    )

@router.post("/sync")
async def sync_user_identity(payload: dict):
    """
    Ensures an existing client identity from localStorage is present in MongoDB with its public keys.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    pseudonym = payload.get("pseudonym") or f"Anon#{user_id[-4:]}"
    now = time.time()

    existing = await db.users.find_one({"user_id": user_id})
    if existing:
        # Update last seen and online
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"last_seen": now, "is_online": True}}
        )
        return {"status": "success", "user_id": user_id, "synced": "updated"}

    # Insert document
    profile_data = payload.get("profile") or {
        "ghost_id": f"Shadow#{user_id[-4:]}",
        "nickname": pseudonym,
        "avatar_emoji": "👤",
        "avatar_color": "#6366F1",
        "age": None,
        "interests": [],
        "vibe": "",
        "first_name": None,
        "photo_url": None,
        "socials": {},
        "location_sharing_enabled": False,
        "approximate_region": None,
        "approximate_distance_km": None
    }

    user_doc = {
        "user_id": user_id,
        "pseudonym": pseudonym,
        "ed25519_identity_pub": payload.get("ed25519_identity_pub") or "",
        "x25519_signed_prekey": payload.get("x25519_signed_prekey") or "",
        "signed_prekey_sig": payload.get("signed_prekey_sig") or "",
        "one_time_prekeys": payload.get("one_time_prekeys") or [],
        "profile": profile_data,
        "created_at": now,
        "last_seen": now,
        "is_online": True
    }

    await db.users.insert_one(user_doc)
    return {"status": "success", "user_id": user_id, "synced": "inserted"}

