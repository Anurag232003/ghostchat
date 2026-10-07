import time
import random
import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..database import get_db
from ..websocket_manager import ws_manager

logger = logging.getLogger("e2ee.missions")
router = APIRouter(prefix="/api/blind-date/missions", tags=["Blind Date Missions"])

# 36 Curated Blind Date Missions (More than 30 as requested!)
BLIND_DATE_MISSIONS: List[Dict[str, Any]] = [
    {
        "id": "mission_1",
        "number": 1,
        "title": "Mission #1",
        "prompt": "Tell them something you've never told a stranger.",
        "category": "vulnerability",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🤫",
        "chat_starter": "Honestly, something I've never told a stranger before is: "
    },
    {
        "id": "mission_2",
        "number": 2,
        "title": "Mission #2",
        "prompt": "Ask them about their dream career.",
        "category": "career",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "💼",
        "chat_starter": "If money and limitations didn't exist, what is your absolute dream career?"
    },
    {
        "id": "mission_3",
        "number": 3,
        "title": "Mission #3",
        "prompt": "Both choose a fictional world you'd live in.",
        "category": "imagination",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🏰",
        "chat_starter": "If you could teleport permanently into any fictional universe (Hogwarts, Middle-earth, Cyberpunk 2077, Star Wars), which one do you pick?"
    },
    {
        "id": "mission_4",
        "number": 4,
        "title": "Mission #4",
        "prompt": "Send a voice note saying your favourite song.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "🎙️",
        "chat_starter": "🎙️ [Voice Note Challenge]: Saying my favourite song and why it touches my soul!"
    },
    {
        "id": "mission_5",
        "number": 5,
        "title": "Mission #5",
        "prompt": "Describe your happiest childhood memory in 3 sentences.",
        "category": "nostalgia",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎈",
        "chat_starter": "My happiest childhood memory in three sentences: "
    },
    {
        "id": "mission_6",
        "number": 6,
        "title": "Mission #6",
        "prompt": "Confess an irrational fear that makes zero logical sense.",
        "category": "vulnerability",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🕷️",
        "chat_starter": "Okay, my most completely irrational fear that makes zero sense is: "
    },
    {
        "id": "mission_7",
        "number": 7,
        "title": "Mission #7",
        "prompt": "Share the most impulsive purchase or decision you ever made.",
        "category": "stories",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🛍️",
        "chat_starter": "The most reckless or impulsive decision I ever made on a whim was: "
    },
    {
        "id": "mission_8",
        "number": 8,
        "title": "Mission #8",
        "prompt": "Send a voice note doing your best impression of a movie character.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "🎬",
        "chat_starter": "🎙️ [Voice Note]: My dramatic movie character impression!"
    },
    {
        "id": "mission_9",
        "number": 9,
        "title": "Mission #9",
        "prompt": "Ask them: If you could time-travel to any era for 24 hours, where would you go?",
        "category": "imagination",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "⏳",
        "chat_starter": "Time machine query: If you had 24 hours in any past or future era, where and when are you landing?"
    },
    {
        "id": "mission_10",
        "number": 10,
        "title": "Mission #10",
        "prompt": "Share your ultimate comfort food that you eat when nobody is watching.",
        "category": "lifestyle",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🍜",
        "chat_starter": "My ultimate unhinged comfort food when I'm completely alone is: "
    },
    {
        "id": "mission_11",
        "number": 11,
        "title": "Mission #11",
        "prompt": "Both name a book, movie, or song that genuinely changed your perspective on life.",
        "category": "depth",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "📖",
        "chat_starter": "The piece of art (book, film, or album) that permanently rewired my thinking was: "
    },
    {
        "id": "mission_12",
        "number": 12,
        "title": "Mission #12",
        "prompt": "Send an encrypted photo or image of your favourite view or vibe.",
        "category": "media",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "📷",
        "chat_starter": "📎 [Encrypted Snapshot]: Here is an aesthetic view that represents my soul's vibe!"
    },
    {
        "id": "mission_13",
        "number": 13,
        "title": "Mission #13",
        "prompt": "Confess a guilty pleasure song you secretly blast when driving or home alone.",
        "category": "music",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎧",
        "chat_starter": "My top secret guilty pleasure track that I blast at maximum volume is: "
    },
    {
        "id": "mission_14",
        "number": 14,
        "title": "Mission #14",
        "prompt": "Ask them: What is one misconception people often have when they first meet you?",
        "category": "authenticity",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎭",
        "chat_starter": "First impression audit: What is one thing people almost always get wrong about you initially?"
    },
    {
        "id": "mission_15",
        "number": 15,
        "title": "Mission #15",
        "prompt": "Describe your ideal Sunday morning in vivid sensory detail.",
        "category": "lifestyle",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "☕",
        "chat_starter": "My sacred, perfect Sunday morning looks and smells like this: "
    },
    {
        "id": "mission_16",
        "number": 16,
        "title": "Mission #16",
        "prompt": "Both answer: What would your signature cocktail or mocktail be named and taste like?",
        "category": "fun",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🍸",
        "chat_starter": "If a bartender created a drink named after my personality, it would be called: "
    },
    {
        "id": "mission_17",
        "number": 17,
        "title": "Mission #17",
        "prompt": "Send a voice note whispering your favourite quote or personal motto.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "🎙️",
        "chat_starter": "🎙️ [Voice Note]: A motto that guides my life."
    },
    {
        "id": "mission_18",
        "number": 18,
        "title": "Mission #18",
        "prompt": "Tell them about a random act of kindness you witnessed or received that stayed with you.",
        "category": "depth",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "💖",
        "chat_starter": "A small moment of kindness from a stranger that I will never forget: "
    },
    {
        "id": "mission_19",
        "number": 19,
        "title": "Mission #19",
        "prompt": "Ask them: What is one skill or craft you've always wished you could master overnight?",
        "category": "aspirations",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "⚡",
        "chat_starter": "Matrix instant download: If you could plug a cable in and master any skill in 10 seconds, what would it be?"
    },
    {
        "id": "mission_20",
        "number": 20,
        "title": "Mission #20",
        "prompt": "Both agree on the single greatest video game or animated film of all time.",
        "category": "culture",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎮",
        "chat_starter": "Defend your crown: What is the undisputed, undisputed masterpiece of gaming or animation?"
    },
    {
        "id": "mission_21",
        "number": 21,
        "title": "Mission #21",
        "prompt": "Share your secret habit or midnight routine when everyone else is asleep.",
        "category": "vulnerability",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🌙",
        "chat_starter": "At 2 AM when the entire city is silent, my secret habit is: "
    },
    {
        "id": "mission_22",
        "number": 22,
        "title": "Mission #22",
        "prompt": "Ask them: If you could invite any 3 historical or living people to dinner, who is at the table?",
        "category": "imagination",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🍽️",
        "chat_starter": "The legendary dinner party: Who are the 3 people (alive or historical) sitting at your table?"
    },
    {
        "id": "mission_23",
        "number": 23,
        "title": "Mission #23",
        "prompt": "Describe what your dream sanctuary home looks like (cabin, penthouse, beach bungalow).",
        "category": "lifestyle",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🏡",
        "chat_starter": "My dream physical sanctuary in this world looks like: "
    },
    {
        "id": "mission_24",
        "number": 24,
        "title": "Mission #24",
        "prompt": "Send a voice note laughing or sharing a joke that always cracks you up.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "😂",
        "chat_starter": "🎙️ [Voice Note]: The dumbest joke or story that still makes me laugh every time."
    },
    {
        "id": "mission_25",
        "number": 25,
        "title": "Mission #25",
        "prompt": "Confess a fashion phase or haircut from your past that you deeply cringe at now.",
        "category": "fun",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "💇",
        "chat_starter": "My most catastrophic past fashion or haircut era was definitely: "
    },
    {
        "id": "mission_26",
        "number": 26,
        "title": "Mission #26",
        "prompt": "Ask them: What is a small daily ritual that genuinely keeps you sane?",
        "category": "lifestyle",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🧘",
        "chat_starter": "Grounding check: What tiny habit or ritual during the day keeps your peace of mind intact?"
    },
    {
        "id": "mission_27",
        "number": 27,
        "title": "Mission #27",
        "prompt": "Both choose: Cyberpunk neo-Tokyo 🌃 OR Enchanted medieval fantasy kingdom 🏰?",
        "category": "imagination",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🔮",
        "chat_starter": "Aesthetic dilemma: Neon rain-slicked cyberpunk metropolis or glowing magical forest castle?"
    },
    {
        "id": "mission_28",
        "number": 28,
        "title": "Mission #28",
        "prompt": "Share the story behind a nickname you've had or your username origin.",
        "category": "identity",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🏷️",
        "chat_starter": "The origin story behind my nickname or online handle is: "
    },
    {
        "id": "mission_29",
        "number": 29,
        "title": "Mission #29",
        "prompt": "Ask them: What is the most memorable concert, festival, or live event you ever attended?",
        "category": "music",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎪",
        "chat_starter": "Live energy: What concert, gig, or festival had an energy that gave you chills?"
    },
    {
        "id": "mission_30",
        "number": 30,
        "title": "Mission #30",
        "prompt": "Send a voice note describing what you think your match looks or acts like right now.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "🎙️",
        "chat_starter": "🎙️ [Voice Note]: My intuitive impression of your vibe and presence!"
    },
    {
        "id": "mission_31",
        "number": 31,
        "title": "Mission #31",
        "prompt": "Confess an unpopular opinion you hold with intense passion.",
        "category": "hot_takes",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🔥",
        "chat_starter": "My fiercely held unpopular opinion that always starts arguments: "
    },
    {
        "id": "mission_32",
        "number": 32,
        "title": "Mission #32",
        "prompt": "Ask them: If you were guaranteed 100% success, what crazy venture would you launch tomorrow?",
        "category": "aspirations",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🚀",
        "chat_starter": "Zero fear of failure: What wild company, creation, or moonshot would you build?"
    },
    {
        "id": "mission_33",
        "number": 33,
        "title": "Mission #33",
        "prompt": "Both choose a soundtrack song that should play when you enter a room.",
        "category": "music",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🎵",
        "chat_starter": "Entrance anthem: If a camera tracked you walking into an event, what beat drops?"
    },
    {
        "id": "mission_34",
        "number": 34,
        "title": "Mission #34",
        "prompt": "Share the kindest or most memorable compliment anyone has ever given you.",
        "category": "depth",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🌸",
        "chat_starter": "The most meaningful compliment that truly touched my core was: "
    },
    {
        "id": "mission_35",
        "number": 35,
        "title": "Mission #35",
        "prompt": "Ask them: What is the biggest lesson your last year taught you about yourself?",
        "category": "growth",
        "xp_reward": 20,
        "requires_voice": False,
        "emoji": "🌱",
        "chat_starter": "Growth reflection: What truth did you learn about yourself over the past 12 months?"
    },
    {
        "id": "mission_36",
        "number": 36,
        "title": "Mission #36",
        "prompt": "Send a voice note humming the tune of a song and let them guess it.",
        "category": "voice_note",
        "xp_reward": 20,
        "requires_voice": True,
        "emoji": "🎙️",
        "chat_starter": "🎙️ [Voice Note Mystery]: Guess this song melody I'm humming!"
    }
]

# In-memory mission session state: session_key (room_id or pair_id) -> state dict
mission_sessions: Dict[str, dict] = {}

def get_date_xp_rank(xp: int) -> dict:
    if xp >= 160:
        return {"level": 5, "title": "Cosmic Soulmates", "badge": "🌌", "next_xp": None}
    elif xp >= 120:
        return {"level": 4, "title": "Shadow Alchemist", "badge": "💎", "next_xp": 160}
    elif xp >= 80:
        return {"level": 3, "title": "Deep Resonance", "badge": "🔥", "next_xp": 120}
    elif xp >= 40:
        return {"level": 2, "title": "Wavelength Explorer", "badge": "✨", "next_xp": 80}
    else:
        return {"level": 1, "title": "Curious Spark", "badge": "🌱", "next_xp": 40}

class CompleteMissionRequest(BaseModel):
    session_id: str  # room_id or pair_id
    user_id: str
    mission_id: str
    note: Optional[str] = None

class UnlockMissionRequest(BaseModel):
    session_id: str
    user_id: str

@router.get("")
@router.get("/catalog")
async def get_all_missions():
    """
    Returns the complete catalog of 36 Blind Date missions.
    """
    return {
        "total_missions": len(BLIND_DATE_MISSIONS),
        "reward_per_mission": "✨ Date XP +20",
        "missions": BLIND_DATE_MISSIONS
    }

@router.get("/active")
async def get_active_missions(
    session_id: str = Query(..., description="room_id or pair_id"),
    user_id: Optional[str] = Query(None)
):
    """
    Returns active unlocked missions, completed missions, and current Date XP for a date chamber or pair.
    """
    session = mission_sessions.setdefault(session_id, {
        "session_id": session_id,
        "date_xp": 0,
        "unlocked_mission_ids": ["mission_1", "mission_2"],
        "completed_mission_ids": [],
        "history": []
    })

    # Hydrate mission objects
    all_map = {m["id"]: m for m in BLIND_DATE_MISSIONS}
    unlocked = [all_map[mid] for mid in session["unlocked_mission_ids"] if mid in all_map]
    completed = [all_map[mid] for mid in session["completed_mission_ids"] if mid in all_map]

    xp = session["date_xp"]
    rank = get_date_xp_rank(xp)

    return {
        "session_id": session_id,
        "date_xp": xp,
        "rank": rank,
        "reward_label": "✨ Date XP +20",
        "unlocked_missions": unlocked,
        "completed_missions": completed,
        "total_available": len(BLIND_DATE_MISSIONS)
    }

@router.post("/complete")
async def complete_mission(req: CompleteMissionRequest):
    """
    Completes a mission, awards ✨ Date XP +20, and notifies both participants.
    """
    session = mission_sessions.setdefault(req.session_id, {
        "session_id": req.session_id,
        "date_xp": 0,
        "unlocked_mission_ids": ["mission_1", "mission_2"],
        "completed_mission_ids": [],
        "history": []
    })

    all_map = {m["id"]: m for m in BLIND_DATE_MISSIONS}
    mission = all_map.get(req.mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found in catalog")

    is_already_completed = req.mission_id in session["completed_mission_ids"]
    xp_awarded = 0

    if not is_already_completed:
        session["completed_mission_ids"].append(req.mission_id)
        # Remove from active unlocked
        if req.mission_id in session["unlocked_mission_ids"]:
            session["unlocked_mission_ids"].remove(req.mission_id)
        
        xp_awarded = mission.get("xp_reward", 20)
        session["date_xp"] += xp_awarded

        # Automatically unlock another random mission if fewer than 2 active
        if len(session["unlocked_mission_ids"]) < 2:
            remaining_ids = [m["id"] for m in BLIND_DATE_MISSIONS if m["id"] not in session["completed_mission_ids"] and m["id"] not in session["unlocked_mission_ids"]]
            if remaining_ids:
                next_id = random.choice(remaining_ids)
                session["unlocked_mission_ids"].append(next_id)

    rank = get_date_xp_rank(session["date_xp"])

    # Broadcast real-time signal via WebSocket
    if ":" in req.session_id:
        users = req.session_id.split(":")
        for u in users:
            await ws_manager.send_to_user(u, {
                "type": "signal",
                "signal": {
                    "signal_type": "mission.completed",
                    "session_id": req.session_id,
                    "completed_by": req.user_id,
                    "mission": mission,
                    "xp_awarded": xp_awarded,
                    "total_date_xp": session["date_xp"],
                    "rank": rank,
                    "timestamp": time.time()
                }
            })

    return {
        "status": "completed",
        "mission": mission,
        "xp_awarded": xp_awarded,
        "total_date_xp": session["date_xp"],
        "rank": rank,
        "message": f"✨ Mission Completed! Date XP +{xp_awarded}"
    }

@router.post("/unlock-next")
async def unlock_next_mission(req: UnlockMissionRequest):
    """
    Randomly draws and unlocks the next mission from the 36-mission deck.
    """
    session = mission_sessions.setdefault(req.session_id, {
        "session_id": req.session_id,
        "date_xp": 0,
        "unlocked_mission_ids": ["mission_1", "mission_2"],
        "completed_mission_ids": [],
        "history": []
    })

    remaining = [
        m for m in BLIND_DATE_MISSIONS
        if m["id"] not in session["completed_mission_ids"] and m["id"] not in session["unlocked_mission_ids"]
    ]

    if not remaining:
        return {
            "status": "all_unlocked",
            "message": "All 36 missions have been unlocked or completed!",
            "unlocked_mission": None
        }

    chosen = random.choice(remaining)
    session["unlocked_mission_ids"].append(chosen["id"])

    # Real-time WebSocket broadcast
    if ":" in req.session_id:
        users = req.session_id.split(":")
        for u in users:
            await ws_manager.send_to_user(u, {
                "type": "signal",
                "signal": {
                    "signal_type": "mission.unlocked",
                    "session_id": req.session_id,
                    "unlocked_by": req.user_id,
                    "mission": chosen,
                    "timestamp": time.time()
                }
            })

    return {
        "status": "unlocked",
        "mission": chosen,
        "total_active": len(session["unlocked_mission_ids"]),
        "date_xp": session["date_xp"]
    }

@router.post("/reset")
async def reset_mission_session(session_id: str = Query(...)):
    mission_sessions[session_id] = {
        "session_id": session_id,
        "date_xp": 0,
        "unlocked_mission_ids": ["mission_1", "mission_2", "mission_3", "mission_4"],
        "completed_mission_ids": [],
        "history": []
    }
    return {"status": "reset", "session_id": session_id, "date_xp": 0}
