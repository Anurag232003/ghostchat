import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import AnonymousPersonalityCard, UpdatePersonalityCardRequest

router = APIRouter(prefix="/api/personality-card", tags=["Anonymous Personality Card"])

# In-memory store fallback for environments without persistent MongoDB
PERSONALITY_CARDS_REGISTRY: Dict[str, Dict[str, Any]] = {}

PRESET_VIBES = [
    {"id": "coffee", "label": "☕ Coffee", "category": "lifestyle"},
    {"id": "gaming", "label": "🎮 Gaming", "category": "hobby"},
    {"id": "night_owl", "label": "🌌 Night Owl", "category": "rhythm"},
    {"id": "indie_music", "label": "🎵 Indie Music", "category": "music"},
    {"id": "matcha", "label": "🍵 Matcha", "category": "lifestyle"},
    {"id": "bookworm", "label": "📚 Bookworm", "category": "hobby"},
    {"id": "bouldering", "label": "🧗 Bouldering", "category": "active"},
    {"id": "plant_parent", "label": "🌱 Plant Parent", "category": "lifestyle"},
    {"id": "foodie", "label": "🍣 Foodie", "category": "lifestyle"},
    {"id": "camping", "label": "🏕️ Camping", "category": "outdoors"},
    {"id": "creative_arts", "label": "🎨 Creative Arts", "category": "hobby"},
    {"id": "mindfulness", "label": "🧘 Mindfulness", "category": "wellness"},
    {"id": "early_bird", "label": "🌅 Early Bird", "category": "rhythm"},
    {"id": "cycling", "label": "🚴 Cycling", "category": "active"},
    {"id": "pet_lover", "label": "🐶 Pet Lover", "category": "lifestyle"},
    {"id": "podcasts", "label": "🎙️ Podcasts", "category": "hobby"}
]

PRESET_TOPICS = [
    "Technology",
    "Travel",
    "Movies",
    "Music",
    "Gaming",
    "Philosophy",
    "Science",
    "Startups",
    "Art & Design",
    "Psychology",
    "Food & Culinary",
    "Books & Literature",
    "Anime & Pop Culture",
    "Nature & Outdoors",
    "Astronomy & Cosmos"
]

CONVERSATION_STYLE_LEVELS = [
    {"val": 2, "bar": "██░░░░░░░░", "label": "Quiet Observer"},
    {"val": 4, "bar": "████░░░░░░", "label": "Gentle & Balanced"},
    {"val": 6, "bar": "██████░░░░", "label": "Curious Explorer"},
    {"val": 8, "bar": "████████░░", "label": "Deep & Reflective"},
    {"val": 10, "bar": "██████████", "label": "Expressive Flow"}
]

ENERGY_LEVELS = [
    {"val": 2, "bar": "██░░░░░░░░", "label": "Tranquil & Soft"},
    {"val": 4, "bar": "████░░░░░░", "label": "Chill & Mellow"},
    {"val": 7, "bar": "███████░░░", "label": "Warm & Engaging"},
    {"val": 9, "bar": "█████████░", "label": "Dynamic & Electric"},
    {"val": 10, "bar": "██████████", "label": "High Voltage"}
]

PRIVACY_STATEMENT = "These can be generated from user-selected preferences rather than secretly profiling them."

def generate_block_bar(val: int, max_val: int = 10) -> str:
    """Generates ASCII visual block bar like ████████░░."""
    clamped = max(1, min(max_val, val))
    return "█" * clamped + "░" * (max_val - clamped)

def get_style_label_for_val(val: int) -> str:
    for lvl in reversed(CONVERSATION_STYLE_LEVELS):
        if val >= lvl["val"]:
            return lvl["label"]
    return "Reflective"

def get_energy_label_for_val(val: int) -> str:
    for lvl in reversed(ENERGY_LEVELS):
        if val >= lvl["val"]:
            return lvl["label"]
    return "Balanced"

def get_default_card(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "card_title": "MYSTERY PROFILE",
        "vibes": ["☕ Coffee", "🎮 Gaming", "🌌 Night Owl", "🎵 Indie Music"],
        "conversation_style_val": 8,
        "conversation_style_bar": "████████░░",
        "conversation_style_label": "Deep & Reflective",
        "energy_val": 7,
        "energy_bar": "███████░░░",
        "energy_label": "Warm & Engaging",
        "topics": ["Technology", "Travel", "Movies"],
        "is_generated_from_preferences": True,
        "privacy_notice": PRIVACY_STATEMENT,
        "updated_at": time.time()
    }

@router.get("/options")
async def get_personality_options():
    """
    Returns available user-selectable options for the Anonymous Personality Card:
    vibes, topics, and visual conversation style & energy scales.
    """
    return {
        "status": "success",
        "concept": "MYSTERY PROFILE",
        "privacy_notice": PRIVACY_STATEMENT,
        "preset_vibes": PRESET_VIBES,
        "preset_topics": PRESET_TOPICS,
        "conversation_style_levels": CONVERSATION_STYLE_LEVELS,
        "energy_levels": ENERGY_LEVELS,
        "default_sample": {
            "card_title": "MYSTERY PROFILE",
            "vibes": ["☕ Coffee", "🎮 Gaming", "🌌 Night Owl", "🎵 Indie Music"],
            "conversation_style_bar": "████████░░",
            "energy_bar": "███████░░░",
            "topics": ["Technology", "Travel", "Movies"]
        }
    }

@router.get("/{user_id}", response_model=AnonymousPersonalityCard)
async def get_user_personality_card(user_id: str):
    """
    Retrieves the Anonymous Personality Card for a specific user.
    Falls back to default curated preferences if not yet explicitly saved.
    """
    db = get_db()
    if db is not None:
        doc = await db.personality_cards.find_one({"user_id": user_id}, {"_id": 0})
        if doc:
            return doc

    if user_id in PERSONALITY_CARDS_REGISTRY:
        return PERSONALITY_CARDS_REGISTRY[user_id]

    default_card = get_default_card(user_id)
    return default_card

@router.get("/peer/{peer_id}", response_model=AnonymousPersonalityCard)
async def get_peer_mystery_profile(peer_id: str):
    """
    Retrieves the peer's Anonymous Personality Card (Mystery Profile)
    safely without leaking personal contact info or real names.
    """
    return await get_user_personality_card(peer_id)

@router.post("/{user_id}", response_model=AnonymousPersonalityCard)
async def update_user_personality_card(user_id: str, request: UpdatePersonalityCardRequest):
    """
    Updates or creates an Anonymous Personality Card purely from user-selected preferences.
    Zero secret profiling or automated surveillance.
    """
    existing = await get_user_personality_card(user_id)
    card_dict = dict(existing) if isinstance(existing, dict) else existing.dict()

    if request.vibes is not None:
        card_dict["vibes"] = request.vibes

    if request.conversation_style_val is not None:
        card_dict["conversation_style_val"] = request.conversation_style_val
        card_dict["conversation_style_bar"] = generate_block_bar(request.conversation_style_val)
        card_dict["conversation_style_label"] = request.conversation_style_label or get_style_label_for_val(request.conversation_style_val)

    if request.energy_val is not None:
        card_dict["energy_val"] = request.energy_val
        card_dict["energy_bar"] = generate_block_bar(request.energy_val)
        card_dict["energy_label"] = request.energy_label or get_energy_label_for_val(request.energy_val)

    if request.topics is not None:
        card_dict["topics"] = request.topics

    card_dict["updated_at"] = time.time()
    card_dict["privacy_notice"] = PRIVACY_STATEMENT
    card_dict["is_generated_from_preferences"] = True
    card_dict["card_title"] = "MYSTERY PROFILE"

    # Persist in memory
    PERSONALITY_CARDS_REGISTRY[user_id] = card_dict

    # Persist in DB
    db = get_db()
    if db is not None:
        await db.personality_cards.update_one(
            {"user_id": user_id},
            {"$set": card_dict},
            upsert=True
        )

    return card_dict
