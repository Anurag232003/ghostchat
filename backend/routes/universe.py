import uuid
import time
import random
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import (
    UniverseStarNode,
    UniverseRadarResponse,
    UniverseEnterRequest,
    UniverseConnectStarRequest
)

router = APIRouter(prefix="/api/universe", tags=["Random Universe Matching"])

# In-memory registry for Universe matching rooms and celestial radar cache
UNIVERSE_ROOMS_REGISTRY: Dict[str, Dict[str, Any]] = {}

# Orbital layout coordinate slots for up to 6 celestial stars:
#              ✦ (Zenith)
#       🌌 DISCOVER
#    ✦ (West)  ○ (Core)  ✦ (East)
#        ○ (SW)    ○ (SE)
ORBIT_COORDINATE_SLOTS = [
    {"x": 50, "y": 14, "orbit": 1, "scale": 1.3},   # 0: Zenith
    {"x": 16, "y": 48, "orbit": 2, "scale": 1.2},   # 1: West
    {"x": 50, "y": 48, "orbit": 1, "scale": 1.1},   # 2: Core
    {"x": 84, "y": 48, "orbit": 2, "scale": 1.25},  # 3: East
    {"x": 30, "y": 78, "orbit": 3, "scale": 1.05},  # 4: SouthWest
    {"x": 70, "y": 78, "orbit": 3, "scale": 1.05},  # 5: SouthEast
]

CONSTELLATIONS = [
    ("Cygnus Zenith", "Type-O Blue Hypergiant", "✦"),
    ("Orion Nebula", "Type-B Radiant Pulsar", "✦"),
    ("Lyra Core", "Type-A White Dwarf", "○"),
    ("Cassiopeia Crown", "Type-O Blue Variable", "✦"),
    ("Andromeda Spiral", "Type-G Golden Sol", "○"),
    ("Centaurus Arc", "Type-M Scarlet Giant", "○"),
]

@router.get("/radar", response_model=UniverseRadarResponse)
async def scan_universe_radar(user_id: Optional[str] = Query(None)):
    """
    Scans the celestial universe radar and returns detected mystery stars.
    Each active registered peer appears as an interactive glowing "star" in the cosmos.
    If no other users are currently online/registered, returns 0 signals.
    """
    db = get_db()
    stars_list: List[UniverseStarNode] = []

    if db is not None:
        query = {"user_id": {"$ne": user_id}} if user_id else {}
        cursor = db.users.find(query, {"_id": 0}).limit(6)
        real_users = await cursor.to_list(length=6)

        for idx, u in enumerate(real_users):
            slot = ORBIT_COORDINATE_SLOTS[idx % len(ORBIT_COORDINATE_SLOTS)]
            constellation, spectral, sym = CONSTELLATIONS[idx % len(CONSTELLATIONS)]
            prof = u.get("profile") or {}
            interests = prof.get("interests") or []
            vibe = prof.get("vibe") or ""
            region = prof.get("approximate_region") or "📍 Deep Space"

            vibe_signals = []
            if interests:
                vibe_signals.extend(interests[:3])
            if vibe and len(vibe_signals) < 3:
                vibe_signals.append(f"🌌 {vibe.split('•')[0].strip()}")
            if not vibe_signals:
                vibe_signals = ["🔒 Encrypted Signal", "✨ Anonymous Star"]

            star_node = UniverseStarNode(
                star_id=f"star_{u.get('user_id', uuid.uuid4().hex[:8])}",
                symbol=sym,
                constellation=constellation,
                spectral_type=spectral,
                coordinates=slot,
                pseudonym=f"✨ {u.get('pseudonym', 'Anonymous Star')}",
                vibe_signals=vibe_signals,
                conversation_style_bar="████████░░",
                energy_bar="███████░░░",
                approx_location=region,
                frequency_mhz=f"{1420.400 + (idx * 12.35):.3f} MHz",
                user_id=u.get("user_id")
            )
            stars_list.append(star_node)

    signals_count = len(stars_list)
    return UniverseRadarResponse(
        title="🌌 DISCOVER",
        status="signals_detected" if signals_count > 0 else "idle_scanning",
        total_signals=signals_count,
        signals_label=f"{signals_count} Mystery signals detected" if signals_count > 0 else "0 Mystery signals detected",
        stars=stars_list,
        scan_timestamp=time.time()
    )

@router.post("/enter")
async def enter_universe_matching(req: UniverseEnterRequest):
    """
    [ENTER] trigger on the Discovery UI!
    Sweeps deep space radar, selects a random mystery signal star in the cosmos,
    and initiates an anonymous mystery interaction.
    """
    radar = await scan_universe_radar(user_id=req.user_id)
    available_stars = radar.stars
    if not available_stars:
        return {
            "status": "no_signals",
            "message": "Deep space radar scanned. No other anonymous stars are in range right now. When other users join, their stars will appear here!",
            "room_id": None,
            "peer_user_id": None,
            "peer_ghost": None
        }

    selected_star = random.choice(available_stars)
    room_id = f"universe_bd_{uuid.uuid4().hex[:12]}"
    created_now = time.time()

    room_doc = {
        "room_id": room_id,
        "mode": "universe_mystery",
        "title": "🌌 Universe Mystery Interaction",
        "star_id": selected_star.star_id,
        "star_symbol": selected_star.symbol,
        "constellation": selected_star.constellation,
        "spectral_type": selected_star.spectral_type,
        "peer_ghost": selected_star.pseudonym,
        "peer_user_id": selected_star.user_id,
        "user_id": req.user_id,
        "vibe_signals": selected_star.vibe_signals,
        "conversation_style_bar": selected_star.conversation_style_bar,
        "energy_bar": selected_star.energy_bar,
        "frequency_mhz": selected_star.frequency_mhz,
        "status": "connected",
        "created_at": created_now
    }

    UNIVERSE_ROOMS_REGISTRY[room_id] = room_doc

    return {
        "status": "matched_in_universe",
        "message": "🌌 Cosmic resonance locked! Star frequency synchronized.",
        "room_id": room_id,
        "room": room_doc,
        "matched_star": selected_star,
        "peer_ghost": selected_star.pseudonym,
        "peer_user_id": selected_star.user_id
    }

@router.post("/connect-star")
async def connect_to_specific_star(req: UniverseConnectStarRequest):
    """
    Triggered when a user taps a specific glowing 'star' in the celestial galaxy.
    Instantly tunes frequency and launches a direct mystery interaction with that star!
    """
    radar = await scan_universe_radar(user_id=req.user_id)
    target_star = next((s for s in radar.stars if s.star_id == req.star_id or s.user_id == req.star_id), None)
    if not target_star:
        if radar.stars:
            target_star = radar.stars[0]
        else:
            raise HTTPException(status_code=404, detail="Selected star is no longer in celestial range.")

    room_id = f"universe_bd_{uuid.uuid4().hex[:12]}"
    created_now = time.time()

    room_doc = {
        "room_id": room_id,
        "mode": "universe_star_tuned",
        "title": f"✨ Mystery Interaction • {target_star.constellation}",
        "star_id": target_star.star_id,
        "star_symbol": target_star.symbol,
        "constellation": target_star.constellation,
        "spectral_type": target_star.spectral_type,
        "peer_ghost": target_star.pseudonym,
        "peer_user_id": target_star.user_id,
        "user_id": req.user_id,
        "vibe_signals": target_star.vibe_signals,
        "conversation_style_bar": target_star.conversation_style_bar,
        "energy_bar": target_star.energy_bar,
        "frequency_mhz": target_star.frequency_mhz,
        "status": "connected",
        "created_at": created_now
    }

    UNIVERSE_ROOMS_REGISTRY[room_id] = room_doc

    return {
        "status": "star_frequency_locked",
        "message": f"Tuned into {target_star.constellation} ({target_star.frequency_mhz})! Mystery interaction active.",
        "room_id": room_id,
        "room": room_doc,
        "matched_star": target_star,
        "peer_ghost": target_star.pseudonym,
        "peer_user_id": target_star.user_id
    }
