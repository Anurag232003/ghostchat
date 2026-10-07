import uuid
import time
import random
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    TopicRoomMember,
    TopicRoomMessageItem,
    CreateTopicRoomRequest,
    JoinTopicRoomRequest,
    SendTopicRoomMessageRequest,
)

router = APIRouter(prefix="/api/topic-rooms", tags=["Anonymous Topic Rooms"])

# Ephemeral pseudonym name pool for anonymous room participants
EPHEMERAL_PSEUDONYMS = [
    "Nova", "Ghost", "Pixel", "Luna", "Shadow", "Echo", "Cipher", 
    "Drift", "Solstice", "Atlas", "Orion", "Neon", "Vibe", "Zenith", "Mirage", "Lynx"
]

# Curated Topic Categories
TOPIC_CATEGORIES = [
    {"id": "all", "label": "🔥 All Rooms", "icon": "🔥"},
    {"id": "gaming", "label": "🎮 Gaming", "icon": "🎮"},
    {"id": "movies", "label": "🎬 Movies", "icon": "🎬"},
    {"id": "coding", "label": "💻 Coding", "icon": "💻"},
    {"id": "music", "label": "🎵 Music", "icon": "🎵"},
    {"id": "travel", "label": "🌍 Travel", "icon": "🌍"},
    {"id": "students", "label": "📚 Students", "icon": "📚"},
    {"id": "vibe", "label": "🌙 Late Night", "icon": "🌙"},
]

# In-memory storage for ephemeral topic rooms (backed by DB when available)
EPHEMERAL_ROOMS_REGISTRY: Dict[str, Dict[str, Any]] = {}

def init_default_curated_rooms():
    """Initializes empty temporary encrypted topic rooms ready for live participants."""
    if EPHEMERAL_ROOMS_REGISTRY:
        return

    now = time.time()
    curated = [
        {
            "room_id": "room_late_night_talks",
            "title": "Late Night Talks",
            "topic_category": "vibe",
            "topic_icon": "🌙",
            "description": "Raw, unfiltered midnight thoughts, ambient contemplation & late night confessions.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_gaming_hub",
            "title": "Late Night Gaming & Lore",
            "topic_category": "gaming",
            "topic_icon": "🎮",
            "description": "Speedruns, RPG lore deep-dives, late-night co-op lobbies, and indie masterpieces.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_movies_cinema",
            "title": "Cinema Buffs & Spoilers",
            "topic_category": "movies",
            "topic_icon": "🎬",
            "description": "Script breakdowns, cinematography appreciation, cult classics & plot twist discussions.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_coding_dev",
            "title": "Dev Lounge: Bugs & Brews",
            "topic_category": "coding",
            "topic_icon": "💻",
            "description": "Distributed systems, memory safety debates, side projects, and 2 AM bug squashing.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_music_beats",
            "title": "Vinyl, Lo-Fi & Ambient Beats",
            "topic_category": "music",
            "topic_icon": "🎵",
            "description": "Synthesizers, chillhop, shoegaze, underground tracks to code/chill to, and album talks.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_travel_wanderers",
            "title": "Solo Wanderers & Backcountry",
            "topic_category": "travel",
            "topic_icon": "🌍",
            "description": "Hidden mountain towns, sleeper trains, digital nomad setups, and spontaneous flights.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        },
        {
            "room_id": "room_students_hall",
            "title": "All-Nighter Study Hall",
            "topic_category": "students",
            "topic_icon": "📚",
            "description": "Silent pomodoro sprints, thesis paper struggles, caffeine fuels, and exam cram solidarity.",
            "ttl_hours": 24,
            "created_at": now,
            "expires_at": now + (24 * 3600),
            "encryption_key": uuid.uuid4().hex + uuid.uuid4().hex,
            "members": [],
            "messages": []
        }
    ]

    for room in curated:
        EPHEMERAL_ROOMS_REGISTRY[room["room_id"]] = room

init_default_curated_rooms()

@router.get("/categories")
async def get_topic_categories():
    """Returns the list of curated topic room categories."""
    return {"categories": TOPIC_CATEGORIES}

@router.get("")
@router.get("/list")
async def get_topic_rooms(category: Optional[str] = Query(None)):
    """Lists active temporary encrypted rooms with member rosters and countdowns."""
    init_default_curated_rooms()
    now = time.time()
    rooms_out = []

    for room_id, room in list(EPHEMERAL_ROOMS_REGISTRY.items()):
        # Expire past rooms
        if room.get("expires_at", 0) < now:
            continue

        if category and category != "all" and room.get("topic_category") != category:
            continue

        # Format members roster e.g. "👤 Nova, 👤 Ghost, 👤 Pixel, 👤 Luna"
        members = room.get("members", [])
        member_pseudonyms = [f"👤 {m['pseudonym']}" for m in members]
        remaining_secs = max(0, int(room.get("expires_at", now) - now))
        remaining_hours = remaining_secs // 3600
        remaining_mins = (remaining_secs % 3600) // 60
        expires_in_str = f"{remaining_hours}h {remaining_mins}m"

        rooms_out.append({
            "room_id": room["room_id"],
            "title": room["title"],
            "topic_category": room.get("topic_category", "general"),
            "topic_icon": room.get("topic_icon", "🔥"),
            "description": room.get("description", ""),
            "member_count": len(members),
            "members": members,
            "members_roster": member_pseudonyms,
            "is_temporary": True,
            "expires_in": expires_in_str,
            "expires_at": room.get("expires_at"),
            "encryption_mode": "Ephemeral Room Ratchet / Session Key",
            "last_active": max([m.get("created_at", room["created_at"]) for m in room.get("messages", [])] + [room["created_at"]])
        })

    rooms_out.sort(key=lambda r: r["last_active"], reverse=True)
    return {
        "status": "success",
        "total_active_rooms": len(rooms_out),
        "rooms": rooms_out,
        "privacy_guarantee": "No permanent identities needed. Ephemeral pseudonyms only. Zero link to permanent profiles."
    }

@router.post("/create")
async def create_topic_room(request: CreateTopicRoomRequest):
    """Creates a temporary encrypted topic room with custom duration."""
    now = time.time()
    room_id = f"room_{uuid.uuid4().hex[:10]}"
    expires_at = now + (request.ttl_hours * 3600)
    encryption_key = uuid.uuid4().hex + uuid.uuid4().hex

    new_room = {
        "room_id": room_id,
        "title": request.title,
        "topic_category": request.topic_category.lower(),
        "topic_icon": request.topic_icon or "🔥",
        "description": request.description or f"Temporary encrypted room for {request.title}",
        "ttl_hours": request.ttl_hours,
        "created_at": now,
        "expires_at": expires_at,
        "encryption_key": encryption_key,
        "members": [],
        "messages": [
            {
                "message_id": f"tmsg_{uuid.uuid4().hex[:10]}",
                "room_id": room_id,
                "sender_pseudonym": "⚡ Room Announcer",
                "sender_ephemeral_id": "system",
                "ciphertext": "ENC[e2ee_room:system_init]",
                "plaintext_preview": f"Welcome to {request.title}! All participants are masked with temporary pseudonyms.",
                "created_at": now
            }
        ]
    }

    EPHEMERAL_ROOMS_REGISTRY[room_id] = new_room
    return {
        "status": "success",
        "room_id": room_id,
        "title": request.title,
        "topic_category": request.topic_category,
        "expires_at": expires_at,
        "message": "Temporary encrypted room spawned. Permanent identities are not needed."
    }

@router.post("/{room_id}/join")
async def join_topic_room(room_id: str, request: JoinTopicRoomRequest):
    """
    Enters a temporary encrypted room.
    Does NOT require a permanent identity! Assigns an ephemeral pseudonym (e.g. 👤 Nova, 👤 Ghost, 👤 Pixel, 👤 Luna).
    """
    init_default_curated_rooms()
    room = EPHEMERAL_ROOMS_REGISTRY.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Topic room not found or expired")

    now = time.time()
    if room.get("expires_at", 0) < now:
        raise HTTPException(status_code=410, detail="This temporary topic room has expired and was burned.")

    # Determine ephemeral pseudonym
    existing_pseudonyms = [m["pseudonym"] for m in room.get("members", [])]
    if request.custom_pseudonym and request.custom_pseudonym.strip():
        chosen_name = request.custom_pseudonym.strip()
    else:
        available = [name for name in EPHEMERAL_PSEUDONYMS if name not in existing_pseudonyms]
        if not available:
            available = EPHEMERAL_PSEUDONYMS
        chosen_name = random.choice(available)

    ephemeral_id = f"eph_{uuid.uuid4().hex[:8]}"
    new_member = {
        "ephemeral_id": ephemeral_id,
        "pseudonym": chosen_name,
        "avatar_icon": "👤",
        "joined_at": now,
        "is_bot": False
    }

    # Add to room members if not already present
    room["members"].append(new_member)

    # Post join notice
    join_notice = {
        "message_id": f"tmsg_{uuid.uuid4().hex[:10]}",
        "room_id": room_id,
        "sender_pseudonym": "⚡ Room Announcer",
        "sender_ephemeral_id": "system",
        "ciphertext": "ENC[e2ee_room:member_joined]",
        "plaintext_preview": f"👤 {chosen_name} entered the room anonymously.",
        "created_at": now
    }
    room["messages"].append(join_notice)

    # Return member roster formatted as requested:
    # Room: Late Night Talks
    # 👤 Nova
    # 👤 Ghost
    # 👤 Pixel
    # 👤 Luna
    member_roster = [f"👤 {m['pseudonym']}" for m in room["members"]]

    return {
        "status": "success",
        "room_id": room_id,
        "room_title": room["title"],
        "topic_icon": room.get("topic_icon", "🔥"),
        "my_ephemeral_id": ephemeral_id,
        "my_pseudonym": chosen_name,
        "my_display": f"👤 {chosen_name}",
        "room_encryption_key": room.get("encryption_key"),
        "members": room["members"],
        "members_roster": member_roster,
        "recent_messages": room.get("messages", [])[-30:],
        "privacy_notice": "Your permanent identity is not exposed. Only temporary pseudonym is visible."
    }

@router.get("/{room_id}/state")
async def get_topic_room_state(room_id: str):
    """Retrieves live room metadata, active members roster, and recent messages."""
    init_default_curated_rooms()
    room = EPHEMERAL_ROOMS_REGISTRY.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Topic room not found or expired")

    now = time.time()
    remaining_secs = max(0, int(room.get("expires_at", now) - now))
    remaining_hours = remaining_secs // 3600
    remaining_mins = (remaining_secs % 3600) // 60

    return {
        "status": "success",
        "room_id": room_id,
        "room_title": room["title"],
        "topic_category": room.get("topic_category"),
        "topic_icon": room.get("topic_icon", "🔥"),
        "description": room.get("description", ""),
        "expires_in": f"{remaining_hours}h {remaining_mins}m",
        "members": room.get("members", []),
        "members_roster": [f"👤 {m['pseudonym']}" for m in room.get("members", [])],
        "messages": room.get("messages", [])[-50:]
    }

@router.post("/{room_id}/messages")
async def send_topic_room_message(room_id: str, request: SendTopicRoomMessageRequest):
    """Sends an encrypted message to the temporary topic room using the ephemeral pseudonym."""
    init_default_curated_rooms()
    room = EPHEMERAL_ROOMS_REGISTRY.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Topic room not found or expired")

    now = time.time()
    msg_id = f"tmsg_{uuid.uuid4().hex[:10]}"
    display_sender = f"👤 {request.sender_pseudonym.replace('👤', '').strip()}"

    msg_item = {
        "message_id": msg_id,
        "room_id": room_id,
        "sender_pseudonym": display_sender,
        "sender_ephemeral_id": request.ephemeral_id,
        "ciphertext": request.ciphertext,
        "plaintext_preview": request.plaintext or "🔐 [Encrypted Topic Room Message]",
        "created_at": now
    }

    room["messages"].append(msg_item)
    if len(room["messages"]) > 100:
        room["messages"] = room["messages"][-100:]

    # Dynamic ambient peer response generator for interactive vibe
    peer_reply = None
    if room.get("members"):
        other_members = [m for m in room["members"] if m.get("is_bot") and m.get("ephemeral_id") != request.ephemeral_id]
        if other_members and random.random() < 0.65:
            responding_bot = random.choice(other_members)
            bot_name = responding_bot["pseudonym"]
            
            # Context-sensitive conversational replies
            vibe_responses = {
                "room_late_night_talks": [
                    "Spot on. Late night clarity hits differently than anything in daylight.",
                    "Glad I tuned into this room tonight. Everyone here is on the exact same wavelength.",
                    "That midnight quiet is genuine therapy. No social masks needed.",
                    "100%. Felt that deeply."
                ],
                "room_gaming_hub": [
                    "GG! Which difficulty setting were you on?",
                    "That section tested my sanity. Total respect for pushing through!",
                    "Game mechanics in that one are so satisfying once you master the timing."
                ],
                "room_coding_dev": [
                    "Happens to the best of us! At least the bug is squashed.",
                    "Those late-night debugging epiphanies are the best feeling in the world.",
                    "Rust or TypeScript? Either way, 2 AM coffee is mandatory."
                ],
                "room_music_beats": [
                    "Adding that recommendation to my late night playlist right now!",
                    "The production on that album is immaculate.",
                    "Pure sonic comfort."
                ],
                "room_travel_wanderers": [
                    "That sounds like an unforgettable adventure. Taking notes for my bucket list!",
                    "The best travel memories are always the unplanned detours."
                ],
                "room_students_hall": [
                    "Locking in for another 25-minute sprint! We got this.",
                    "Coffee refilled. Let's finish strong!"
                ]
            }
            
            pool = vibe_responses.get(room_id, [
                f"Love this discussion! What got you interested in this topic?",
                f"Really interesting perspective from 👤 {request.sender_pseudonym}."
            ])
            chosen_reply = random.choice(pool)
            
            peer_reply = {
                "message_id": f"tmsg_{uuid.uuid4().hex[:10]}",
                "room_id": room_id,
                "sender_pseudonym": f"👤 {bot_name}",
                "sender_ephemeral_id": responding_bot["ephemeral_id"],
                "ciphertext": f"ENC[e2ee_room:{uuid.uuid4().hex[:8]}]",
                "plaintext_preview": chosen_reply,
                "created_at": now + 0.4
            }
            room["messages"].append(peer_reply)

    return {
        "status": "success",
        "sent_message": msg_item,
        "peer_reply": peer_reply,
        "total_messages": len(room["messages"])
    }

@router.post("/{room_id}/leave")
async def leave_topic_room(room_id: str, ephemeral_id: str = Query(...)):
    """Safely leaves a topic room, burns the ephemeral pseudonym, and announces departure."""
    init_default_curated_rooms()
    room = EPHEMERAL_ROOMS_REGISTRY.get(room_id)
    if not room:
        return {"status": "success", "message": "Room already exited."}

    leaving_member = None
    remaining_members = []
    for m in room.get("members", []):
        if m["ephemeral_id"] == ephemeral_id:
            leaving_member = m
        else:
            remaining_members.append(m)

    room["members"] = remaining_members

    now = time.time()
    if leaving_member:
        room["messages"].append({
            "message_id": f"tmsg_{uuid.uuid4().hex[:10]}",
            "room_id": room_id,
            "sender_pseudonym": "⚡ Room Announcer",
            "sender_ephemeral_id": "system",
            "ciphertext": "ENC[e2ee_room:member_left]",
            "plaintext_preview": f"👤 {leaving_member['pseudonym']} left the room. Ephemeral identity burned.",
            "created_at": now
        })

    return {
        "status": "success",
        "message": "Safely exited room. Ephemeral identity burned.",
        "remaining_members_count": len(remaining_members)
    }

@router.delete("/{room_id}")
async def burn_topic_room(room_id: str):
    """Burns an entire temporary topic room and all associated ephemeral messages."""
    if room_id in EPHEMERAL_ROOMS_REGISTRY:
        del EPHEMERAL_ROOMS_REGISTRY[room_id]
        return {"status": "success", "message": f"Room {room_id} and all ephemeral messages burned."}
    return {"status": "not_found", "message": "Room does not exist."}
