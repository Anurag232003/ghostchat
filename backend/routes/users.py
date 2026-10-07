import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..websocket_manager import ws_manager
from ..models import (
    UserProfileResponse,
    PrekeyBundleResponse,
    RevealedProfileResponse,
    UnlockLevelRequest,
    ProgressiveRevealStatusResponse,
    ProgressiveRevealDeclareInterestRequest,
    ProgressiveRevealPhotoRequest,
    ProgressiveRevealPhotoConsentRequest,
    ProgressiveRevealFastForwardRequest
)

router = APIRouter(prefix="/api/users", tags=["Users & Prekey Directory"])

@router.get("/list", response_model=List[UserProfileResponse])
async def list_users(exclude_id: Optional[str] = Query(None)):
    db = get_db()
    if db is None:
        return []

    query = {}
    if exclude_id:
        query["user_id"] = {"$ne": exclude_id}

    cursor = db.users.find(query).sort("created_at", -1)
    users = await cursor.to_list(length=100)

    result = []
    for u in users:
        is_online = ws_manager.is_online(u["user_id"])
        result.append(UserProfileResponse(
            user_id=u["user_id"],
            pseudonym=u["pseudonym"],
            ed25519_identity_pub=u["ed25519_identity_pub"],
            created_at=u.get("created_at", 0),
            is_online=is_online,
            last_seen=u.get("last_seen", 0),
            profile=u.get("profile")
        ))
    return result

@router.get("/{user_id}/revealed-to/{viewer_id}", response_model=RevealedProfileResponse)
async def get_revealed_profile(user_id: str, viewer_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    target_user = await db.users.find_one({"user_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    profile = target_user.get("profile") or {}
    ghost_id = profile.get("ghost_id") or f"Shadow#{user_id[-4:]}"

    # If viewing self, return Level 5
    if user_id == viewer_id:
        level_unlocked = 5
    else:
        # Check database for granted level from user_id to viewer_id
        unlock_doc = await db.identity_unlocks.find_one({
            "granter_id": user_id,
            "grantee_id": viewer_id
        })
        # Default starting level is Level 1 (Nickname + Avatar) or Level 0 if completely shrouded
        level_unlocked = unlock_doc.get("level", 1) if unlock_doc else 1

    # Progressive Reveal Filtering (Zero Information Leakage beyond granted level)
    res = RevealedProfileResponse(
        user_id=user_id,
        level_unlocked=level_unlocked,
        ghost_id=ghost_id
    )

    if level_unlocked >= 1:
        res.nickname = profile.get("nickname") or f"🌙 {target_user['pseudonym']}"
        res.avatar_emoji = profile.get("avatar_emoji", "🌙")
        res.avatar_color = profile.get("avatar_color", "#38BDF8")

    if level_unlocked >= 2:
        res.age = profile.get("age", 23)
        res.interests = profile.get("interests", ["☕ Coffee", "🎮 Gaming", "🎵 Music"])
        res.vibe = profile.get("vibe", "Night owl • Lo-fi beats")

        # 17. 📍 Approximate Location (Only if user explicitly enabled location sharing)
        if profile.get("location_sharing_enabled", False):
            res.location_sharing_enabled = True
            reg = profile.get("approximate_region", "Delhi NCR")
            dist = profile.get("approximate_distance_km", 8)
            res.approximate_distance_str = f"📍 ~{dist} km away"
            res.approximate_region = f"📍 {reg}"
            res.approximate_location = f"📍 ~{dist} km away"

    if level_unlocked >= 3:
        res.first_name = profile.get("first_name", target_user['pseudonym'].split()[0])

    if level_unlocked >= 4:
        res.photo_url = profile.get("photo_url")

    if level_unlocked >= 5:
        res.socials = profile.get("socials", {})

    return res

@router.post("/unlock-level")
async def unlock_identity_level(request: UnlockLevelRequest, user_id: str = Query(...)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    if request.action == "grant":
        await db.identity_unlocks.update_one(
            {"granter_id": user_id, "grantee_id": request.target_user_id},
            {"$set": {
                "granter_id": user_id,
                "grantee_id": request.target_user_id,
                "level": request.target_level,
                "updated_at": time.time()
            }},
            upsert=True
        )

        # Notify grantee in real time via WebSocket
        signal_packet = {
            "type": "signal",
            "signal": {
                "signal_type": "identity.unlock_grant",
                "conversation_id": request.target_user_id,
                "sender_id": user_id,
                "recipient_id": request.target_user_id,
                "data": {
                    "granted_by": user_id,
                    "new_level": request.target_level
                },
                "timestamp": time.time()
            }
        }
        await ws_manager.send_to_user(request.target_user_id, signal_packet)

        return {"status": "granted", "level": request.target_level}

    elif request.action == "request":
        # Send unlock request signal to target peer
        signal_packet = {
            "type": "signal",
            "signal": {
                "signal_type": "identity.unlock_request",
                "conversation_id": request.target_user_id,
                "sender_id": user_id,
                "recipient_id": request.target_user_id,
                "data": {
                    "requested_by": user_id,
                    "target_level": request.target_level
                },
                "timestamp": time.time()
            }
        }
        await ws_manager.send_to_user(request.target_user_id, signal_packet)
        return {"status": "requested", "level": request.target_level}

@router.get("/{user_id}/prekey-bundle", response_model=PrekeyBundleResponse)
async def get_prekey_bundle(user_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Peer not found")

    # Pop one one-time prekey atomically if available
    one_time_prekey = None
    ot_keys = user.get("one_time_prekeys", [])
    if ot_keys and len(ot_keys) > 0:
        one_time_prekey = ot_keys[0]
        # Pop from list
        await db.users.update_one(
            {"user_id": user_id},
            {"$pop": {"one_time_prekeys": -1}}
        )

    return PrekeyBundleResponse(
        user_id=user["user_id"],
        pseudonym=user["pseudonym"],
        ed25519_identity_pub=user["ed25519_identity_pub"],
        x25519_signed_prekey=user["x25519_signed_prekey"],
        signed_prekey_sig=user["signed_prekey_sig"],
        one_time_prekey=one_time_prekey
    )

@router.post("/{user_id}/replenish-prekeys")
async def replenish_prekeys(user_id: str, keys: List[str]):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database error")

    await db.users.update_one(
        {"user_id": user_id},
        {"$push": {"one_time_prekeys": {"$each": keys}}}
    )
    return {"status": "success", "added_count": len(keys)}


# ---------------------------------------------------------------------------
# 7. 👻 Progressive Identity Reveal (Mystery -> 5m Interest -> 10m Nickname -> Mutual Avatar -> Mutual Photo)
# ---------------------------------------------------------------------------

progressive_sessions: dict = {}

def get_canonical_pair_id(u1: str, u2: str) -> str:
    return ":".join(sorted([u1, u2]))

async def get_or_create_progressive_session(pair_id: str, u1: str, u2: str, db):
    session = progressive_sessions.get(pair_id)
    if not session and db is not None:
        session = await db.progressive_reveal_sessions.find_one({"pair_id": pair_id})

    now = time.time()
    if not session:
        session = {
            "pair_id": pair_id,
            "users": [u1, u2],
            "started_at": now,
            "bonus_seconds": 0,
            "interests_declared": {u1: False, u2: False},
            "mutual_interest": False,
            "photo_requests": {
                "requester_id": None,
                "status": "idle",
                "consents": {u1: None, u2: None},
                "updated_at": now
            },
            "created_at": now
        }
        progressive_sessions[pair_id] = session
        if db is not None:
            await db.progressive_reveal_sessions.insert_one(dict(session))
    else:
        progressive_sessions[pair_id] = session

    return session

@router.get("/progressive-reveal/status", response_model=ProgressiveRevealStatusResponse)
async def get_progressive_reveal_status(user_id: str = Query(...), peer_id: str = Query(...)):
    db = get_db()
    pair_id = get_canonical_pair_id(user_id, peer_id)
    session = await get_or_create_progressive_session(pair_id, user_id, peer_id, db)

    # Calculate live elapsed seconds (real-time + bonus for fast-forward testing)
    now = time.time()
    started_at = session.get("started_at", now)
    bonus_sec = session.get("bonus_seconds", 0)
    elapsed = max(0.0, (now - started_at) + bonus_sec)

    # Fetch peer details
    peer_doc = await db.users.find_one({"user_id": peer_id}) if db is not None else None
    peer_profile = (peer_doc or {}).get("profile") or {}
    peer_ghost_id = peer_profile.get("ghost_id") or f"Shadow#{peer_id[-4:]}"

    # Determine progression stage
    # Stage 0: 🌑 Mystery Person (0 - 5 min)
    # Stage 1: Interest #1 revealed (5 - 10 min)
    # Stage 2: Nickname revealed (10+ min)
    # Stage 3: Avatar revealed (After mutual interest)
    # Stage 4: Photo Reveal (Mutual consent required)

    stage = 0
    stage_name = "Mystery Person"
    interest_1_unlocked = False
    interest_1 = None
    nickname_unlocked = False
    nickname = None
    avatar_emoji = None
    avatar_color = None
    photo_unlocked = False
    photo_url = None
    first_name = None

    if elapsed >= 300:  # 5 minutes
        stage = 1
        stage_name = "Interest #1 Revealed"
        interest_1_unlocked = True
        interests_list = peer_profile.get("interests") or ["☕ Coffee", "🎮 Gaming", "🎵 Music"]
        interest_1 = interests_list[0] if interests_list else "🎮 Gaming"

    if elapsed >= 600:  # 10 minutes
        stage = 2
        stage_name = "Nickname Revealed"
        nickname_unlocked = True
        nickname = peer_profile.get("nickname") or (peer_doc.get("pseudonym") if peer_doc else "Nova")

    mutual_interest_unlocked = session.get("mutual_interest", False)
    if mutual_interest_unlocked:
        stage = max(stage, 3)
        stage_name = "Avatar Revealed"
        avatar_emoji = peer_profile.get("avatar_emoji", "🌙")
        avatar_color = peer_profile.get("avatar_color", "#38BDF8")

    # Photo consent handling
    photo_req = session.get("photo_requests") or {}
    raw_status = photo_req.get("status", "idle")
    requester_id = photo_req.get("requester_id")
    photo_consent_status = raw_status

    prompt_text = None
    requester_nickname = None

    if raw_status == "pending":
        if requester_id == user_id:
            photo_consent_status = "requested_by_me"
        else:
            photo_consent_status = "requested_by_peer"
            requester_doc = await db.users.find_one({"user_id": requester_id}) if db is not None else None
            req_prof = (requester_doc or {}).get("profile") or {}
            requester_nickname = req_prof.get("nickname") or (requester_doc.get("pseudonym") if requester_doc else "Nova")
            prompt_text = f"{requester_nickname} wants to reveal their profile. Reveal to each other?"

    all_interests = None
    age = None
    vibe = None
    socials = None

    if raw_status == "mutual_reveal":
        stage = 4
        stage_name = "Photo Revealed"
        photo_unlocked = True
        photo_url = peer_profile.get("photo_url") or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
        first_name = peer_profile.get("first_name") or (peer_doc.get("pseudonym") if peer_doc else "Nova")
        all_interests = peer_profile.get("interests") or ["☕ Coffee", "🎮 Gaming", "🎵 Music"]
        age = peer_profile.get("age", 23)
        vibe = peer_profile.get("vibe")
        socials = peer_profile.get("socials")

    my_interest = bool(session.get("interests_declared", {}).get(user_id, False))
    peer_interest = bool(session.get("interests_declared", {}).get(peer_id, False))

    return ProgressiveRevealStatusResponse(
        user_id=user_id,
        peer_id=peer_id,
        elapsed_seconds=elapsed,
        stage=stage,
        stage_name=stage_name,
        mystery_title="🌑 Mystery Person",
        ghost_id=peer_ghost_id,
        interest_1_unlocked=interest_1_unlocked,
        interest_1=interest_1,
        nickname_unlocked=nickname_unlocked,
        nickname=nickname,
        mutual_interest_unlocked=mutual_interest_unlocked,
        my_interest_declared=my_interest,
        peer_interest_declared=peer_interest,
        avatar_emoji=avatar_emoji,
        avatar_color=avatar_color,
        photo_unlocked=photo_unlocked,
        photo_url=photo_url,
        first_name=first_name,
        photo_consent_status=photo_consent_status,
        requester_nickname=requester_nickname,
        prompt_text=prompt_text,
        all_interests=all_interests,
        age=age,
        vibe=vibe,
        socials=socials
    )

@router.post("/progressive-reveal/declare-interest")
async def declare_mutual_interest(req: ProgressiveRevealDeclareInterestRequest):
    db = get_db()
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = await get_or_create_progressive_session(pair_id, req.user_id, req.peer_id, db)

    session.setdefault("interests_declared", {})[req.user_id] = req.interested

    # If peer is a companion bot, auto-reciprocate interest
    is_companion = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_companion:
        session["interests_declared"][req.peer_id] = True

    # Check if both declared mutual interest
    u1, u2 = session["users"]
    interest_u1 = session["interests_declared"].get(u1, False)
    interest_u2 = session["interests_declared"].get(u2, False)

    mutual_spark = interest_u1 and interest_u2
    session["mutual_interest"] = mutual_spark

    progressive_sessions[pair_id] = session
    if db is not None:
        await db.progressive_reveal_sessions.update_one(
            {"pair_id": pair_id},
            {"$set": {
                "interests_declared": session["interests_declared"],
                "mutual_interest": session["mutual_interest"]
            }}
        )

    # Real-time WebSocket signal to both users
    for uid in session["users"]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "identity.progressive_reveal_update",
                "pair_id": pair_id,
                "mutual_interest": mutual_spark,
                "stage": 3 if mutual_spark else 2,
                "timestamp": time.time()
            }
        })

    return {
        "status": "success",
        "my_interest": req.interested,
        "mutual_interest": mutual_spark,
        "stage": 3 if mutual_spark else 2
    }

@router.post("/progressive-reveal/request-photo")
async def request_photo_reveal(req: ProgressiveRevealPhotoRequest):
    db = get_db()
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = await get_or_create_progressive_session(pair_id, req.user_id, req.peer_id, db)

    # Fetch user pseudonym/nickname
    requester_doc = await db.users.find_one({"user_id": req.user_id}) if db is not None else None
    requester_prof = (requester_doc or {}).get("profile") or {}
    requester_nickname = requester_prof.get("nickname") or (requester_doc.get("pseudonym") if requester_doc else "Nova")

    session["photo_requests"] = {
        "requester_id": req.user_id,
        "status": "pending",
        "consents": {req.user_id: True, req.peer_id: None},
        "updated_at": time.time()
    }
    progressive_sessions[pair_id] = session
    if db is not None:
        await db.progressive_reveal_sessions.update_one(
            {"pair_id": pair_id},
            {"$set": {"photo_requests": session["photo_requests"]}}
        )

    prompt_text = f"{requester_nickname} wants to reveal their profile. Reveal to each other?"

    # Send prompt signal to target peer
    await ws_manager.send_to_user(req.peer_id, {
        "type": "signal",
        "signal": {
            "signal_type": "identity.photo_reveal_prompt",
            "pair_id": pair_id,
            "requester_id": req.user_id,
            "requester_nickname": requester_nickname,
            "prompt": prompt_text,
            "timestamp": time.time()
        }
    })

    return {
        "status": "requested",
        "prompt": prompt_text,
        "requester_nickname": requester_nickname
    }

@router.post("/progressive-reveal/consent-photo")
async def consent_photo_reveal(req: ProgressiveRevealPhotoConsentRequest):
    db = get_db()
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = await get_or_create_progressive_session(pair_id, req.user_id, req.peer_id, db)

    photo_req = session.setdefault("photo_requests", {
        "requester_id": req.peer_id,
        "status": "pending",
        "consents": {},
        "updated_at": time.time()
    })
    photo_req.setdefault("consents", {})[req.user_id] = req.consent

    if req.consent is True:
        # Check if both consented
        u1, u2 = session["users"]
        c1 = photo_req["consents"].get(u1)
        c2 = photo_req["consents"].get(u2)

        # In companion bot mode, companion also auto-consents
        if req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_"):
            photo_req["consents"][req.peer_id] = True
            c1 = photo_req["consents"].get(u1)
            c2 = photo_req["consents"].get(u2)

        if c1 is True and c2 is True:
            photo_req["status"] = "mutual_reveal"
            outcome = "mutual_reveal"

            # Sync level 4 (Photo) in identity_unlocks
            if db is not None:
                await db.identity_unlocks.update_one(
                    {"granter_id": u1, "grantee_id": u2},
                    {"$set": {"level": 4, "updated_at": time.time()}},
                    upsert=True
                )
                await db.identity_unlocks.update_one(
                    {"granter_id": u2, "grantee_id": u1},
                    {"$set": {"level": 4, "updated_at": time.time()}},
                    upsert=True
                )
        else:
            outcome = "waiting_for_peer"
    else:
        # One user chose [ Keep Anonymous ]
        photo_req["status"] = "declined"
        outcome = "declined"

    photo_req["updated_at"] = time.time()
    progressive_sessions[pair_id] = session
    if db is not None:
        await db.progressive_reveal_sessions.update_one(
            {"pair_id": pair_id},
            {"$set": {"photo_requests": photo_req}}
        )

    # Notify both participants
    for uid in session["users"]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "identity.photo_reveal_result",
                "pair_id": pair_id,
                "outcome": outcome,
                "is_revealed": (photo_req["status"] == "mutual_reveal"),
                "timestamp": time.time()
            }
        })

    return {
        "status": "success",
        "outcome": outcome,
        "is_revealed": (photo_req["status"] == "mutual_reveal")
    }

@router.post("/progressive-reveal/fast-forward")
async def fast_forward_progressive_reveal(req: ProgressiveRevealFastForwardRequest):
    """Testing & Demo aid: Advances chat duration by specified seconds (e.g. +300s or +600s)."""
    db = get_db()
    pair_id = get_canonical_pair_id(req.user_id, req.peer_id)
    session = await get_or_create_progressive_session(pair_id, req.user_id, req.peer_id, db)

    session["bonus_seconds"] = session.get("bonus_seconds", 0) + req.add_seconds
    progressive_sessions[pair_id] = session
    if db is not None:
        await db.progressive_reveal_sessions.update_one(
            {"pair_id": pair_id},
            {"$set": {"bonus_seconds": session["bonus_seconds"]}}
        )

    # Broadcast update signal
    for uid in session["users"]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "identity.progressive_reveal_update",
                "pair_id": pair_id,
                "bonus_seconds": session["bonus_seconds"],
                "timestamp": time.time()
            }
        })

    return {
        "status": "fast_forwarded",
        "added_seconds": req.add_seconds,
        "total_bonus": session["bonus_seconds"]
    }

@router.post("/progressive-reveal/reset")
async def reset_progressive_reveal(user_id: str = Query(...), peer_id: str = Query(...)):
    """Resets progressive reveal session back to 00:00 (Mystery Person) for testing."""
    db = get_db()
    pair_id = get_canonical_pair_id(user_id, peer_id)
    now = time.time()
    session = {
        "pair_id": pair_id,
        "users": [user_id, peer_id],
        "started_at": now,
        "bonus_seconds": 0,
        "interests_declared": {user_id: False, peer_id: False},
        "mutual_interest": False,
        "photo_requests": {
            "requester_id": None,
            "status": "idle",
            "consents": {user_id: None, peer_id: None},
            "updated_at": now
        },
        "created_at": now
    }
    progressive_sessions[pair_id] = session
    if db is not None:
        await db.progressive_reveal_sessions.update_one(
            {"pair_id": pair_id},
            {"$set": session},
            upsert=True
        )

    for uid in [user_id, peer_id]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "identity.progressive_reveal_update",
                "pair_id": pair_id,
                "stage": 0,
                "timestamp": time.time()
            }
        })

    return {"status": "reset", "pair_id": pair_id}
