import uuid
import time
import random
import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from ..database import get_db
from ..websocket_manager import ws_manager
from .safety import sanitize_contact_leaks

logger = logging.getLogger("e2ee.blind_date")
router = APIRouter(prefix="/api/blind-date", tags=["Blind Date Feature"])

# 8. 🎲 Blind Date Mini Games & Compatibility Puzzle Question Deck
COMPATIBILITY_PUZZLE_QUESTIONS = [
    {
        "id": "q0_pizza_burger",
        "type": "this_or_that",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Midnight Craving",
        "question": "Pizza 🍕 or Burger 🍔?",
        "options": ["🍕 Pizza", "🍔 Burger"],
        "tag_map": {
            "🍕 Pizza": "🍕 Pizza lover",
            "🍔 Burger": "🍔 Burger connoisseur",
            "☕ Cozy Cafe & Books": "☕ Cozy Cafe & Books",
            "🌙 Midnight": "🌙 Late nights",
            "🌅 Sunrise": "🌅 Early mornings"
        },
        "topic_map": {
            "🍕 Pizza": "Deep dish, wood-fired thin crust, or cheesy stuffed crust — what's your holy grail slice?",
            "🍔 Burger": "Smash burger, loaded gourmet, or classic cheeseburger — what makes the perfect burger?",
            "☕ Cozy Cafe & Books": "What's your go-to comfort book or cafe spot when unwinding?",
            "🌙 Midnight": "What thoughts or passions keep your mind alive during late midnight hours?"
        },
        "match_topic": "You both chose Pizza 🍕! Deep dish or thin crust — what's your ultimate topping combination?",
        "clash_topic": "Playful food clash! Can a smash burger ever beat a fresh hot slice of pizza?",
        "chemistry_boost": 20
    },
    {
        "id": "q1",
        "type": "this_or_that",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Rhythm of Life",
        "question": "Sunrise or Midnight?",
        "options": ["🌅 Sunrise", "🌙 Midnight"],
        "tag_map": {
            "🌅 Sunrise": "🌅 Early mornings",
            "🌙 Midnight": "🌙 Late nights"
        },
        "topic_map": {
            "🌅 Sunrise": "What's your sacred morning ritual before the world wakes up?",
            "🌙 Midnight": "What thoughts or passions keep your mind alive during late midnight hours?"
        },
        "chemistry_boost": 18
    },
    {
        "id": "q2",
        "type": "this_or_that",
        "title": "🧩 Question 2 • Evening Energy",
        "question": "Introvert evening or party night?",
        "options": ["🛋️ Introvert evening", "🎉 Party night"],
        "tag_map": {
            "🛋️ Introvert evening": "🛋️ Introvert evening",
            "🎉 Party night": "🎉 Party night"
        },
        "topic_map": {
            "🛋️ Introvert evening": "What's your go-to comfort show or book when recharging?",
            "🎉 Party night": "What was the wildest party or festival you ever experienced?"
        },
        "chemistry_boost": 18
    },
    {
        "id": "q3",
        "type": "this_or_that",
        "title": "🧩 Question 3 • Essential Brew",
        "question": "Coffee or Chai?",
        "options": ["☕ Coffee", "🫖 Chai"],
        "tag_map": {
            "☕ Coffee": "☕ Coffee",
            "🫖 Chai": "🫖 Chai"
        },
        "topic_map": {
            "☕ Coffee": "Espresso, cold brew, or cappuccino — what's your ultimate cafe order?",
            "🫖 Chai": "Adrak or Elaichi? What's the secret ingredient in your perfect cup of chai?"
        },
        "chemistry_boost": 18
    },
    {
        "id": "q4",
        "type": "this_or_that",
        "title": "🧩 Question 4 • Wanderlust Style",
        "question": "Travel alone or with friends?",
        "options": ["🎒 Travel alone", "✈️ Travel with friends"],
        "tag_map": {
            "🎒 Travel alone": "🎒 Solo travel",
            "✈️ Travel with friends": "✈️ Travel"
        },
        "topic_map": {
            "🎒 Travel alone": "What's the most eye-opening discovery you made on a solo journey?",
            "✈️ Travel with friends": "What's your dream destination?"
        },
        "chemistry_boost": 18
    },
    {
        "id": "q5",
        "type": "this_or_that",
        "title": "🧩 Question 5 • The ₹10 Lakh Dilemma",
        "question": "If you had ₹10 lakh, what would you do?",
        "options": [
            "✈️ Travel the world",
            "🎮 Build dream gaming rig & tech vault",
            "📈 Invest in high-risk crypto/stocks",
            "🚀 Launch an eccentric indie startup"
        ],
        "tag_map": {
            "✈️ Travel the world": "✈️ Travel",
            "🎮 Build dream gaming rig & tech vault": "🎮 Gaming",
            "📈 Invest in high-risk crypto/stocks": "📈 High-stakes investing",
            "🚀 Launch an eccentric indie startup": "🚀 Moonshot builder"
        },
        "topic_map": {
            "✈️ Travel the world": "What's your dream destination?",
            "🎮 Build dream gaming rig & tech vault": "What game or dream project would you conquer first on a god-tier rig?",
            "📈 Invest in crypto/stocks": "What's your thesis on the future of decentralized tech?",
            "🚀 Launch an eccentric indie startup": "What crazy invention or service would you build with zero fear of failure?"
        },
        "chemistry_boost": 20
    },
    {
        "id": "q6",
        "type": "this_or_that",
        "title": "🧩 Question 6 • Weekend Passion",
        "question": "Gaming marathon or Nature adventure?",
        "options": ["🎮 Gaming marathon", "🌲 Nature adventure"],
        "tag_map": {
            "🎮 Gaming marathon": "🎮 Gaming",
            "🌲 Nature adventure": "🌲 Nature adventure"
        },
        "topic_map": {
            "🎮 Gaming marathon": "What game had an emotional storyline that stayed with you forever?",
            "🌲 Nature adventure": "Mountains or serene lakes — where does your soul feel most grounded?"
        },
        "chemistry_boost": 18
    }
]

CURATED_ACTIVITIES = COMPATIBILITY_PUZZLE_QUESTIONS

def compare_puzzle_answers(activities: List[dict], answers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    common_tags = []
    unlocked_topics = []
    matched_count = 0
    total = len(activities)

    all_users = set()
    for act_key, user_answers in answers.items():
        if isinstance(user_answers, dict):
            all_users.update(user_answers.keys())
    user_list = list(all_users)

    if len(user_list) >= 2:
        u1, u2 = user_list[0], user_list[1]
        for idx, act in enumerate(activities):
            act_key = str(idx)
            ans1 = answers.get(act_key, {}).get(u1)
            ans2 = answers.get(act_key, {}).get(u2)
            if ans1 and ans2:
                tag1 = act.get("tag_map", {}).get(ans1)
                if not tag1:
                    for a in activities:
                        if ans1 in a.get("tag_map", {}):
                            tag1 = a["tag_map"][ans1]
                            break
                tag1 = tag1 or ans1

                tag2 = act.get("tag_map", {}).get(ans2)
                if not tag2:
                    for a in activities:
                        if ans2 in a.get("tag_map", {}):
                            tag2 = a["tag_map"][ans2]
                            break
                tag2 = tag2 or ans2

                if ans1 == ans2 or (tag1 and tag1 == tag2):
                    matched_count += 1
                    matched_tag = tag1 or ans1
                    if matched_tag and matched_tag not in common_tags:
                        common_tags.append(matched_tag)
                    topic = act.get("topic_map", {}).get(ans1) or act.get("topic_map", {}).get(ans2)
                    if not topic:
                        for a in activities:
                            if ans1 in a.get("topic_map", {}):
                                topic = a["topic_map"][ans1]
                                break
                            elif ans2 in a.get("topic_map", {}):
                                topic = a["topic_map"][ans2]
                                break
                    if topic and topic not in unlocked_topics:
                        unlocked_topics.append(topic)


    # Ensure rich fallbacks matching user specification
    if not unlocked_topics:
        unlocked_topics.append("What's your dream destination?")
    if not common_tags:
        common_tags = ["🎮 Gaming", "🌙 Late nights", "✈️ Travel"]

    spark_summary = f"You both chose: {' • '.join(common_tags)}" if common_tags else "You both aligned on core wavelengths!"

    return {
        "matched_count": matched_count,
        "total_questions": total,
        "common_choices": common_tags,
        "unlocked_topics": unlocked_topics,
        "primary_unlocked_topic": unlocked_topics[0] if unlocked_topics else "What's your dream destination?",
        "spark_summary": spark_summary
    }

def get_age_bracket(age: Optional[int]) -> str:
    if not age:
        return "20–24"
    bracket_floor = (age // 5) * 5
    return f"{bracket_floor}–{bracket_floor + 4}"

def build_mystery_card(target_user_doc: Optional[dict]) -> Dict[str, Any]:
    profile = (target_user_doc or {}).get("profile", {})
    age = profile.get("age", 22)
    interests = profile.get("interests") or ["🎮 Gaming", "🎵 Music", "☕ Coffee"]

    # 17. 📍 Approximate Location (Only if user explicitly enables location sharing)
    location_enabled = profile.get("location_sharing_enabled", False)
    approx_location = None
    approx_distance = None
    approx_region = None
    if location_enabled:
        region = profile.get("approximate_region", "Delhi NCR")
        dist_km = profile.get("approximate_distance_km", 8)
        approx_distance = f"📍 ~{dist_km} km away"
        approx_region = f"📍 {region}"
        approx_location = f"{approx_distance} • {region}"

    return {
        "card_title": "Your Mystery Match",
        "handle": "🌑 Unknown",
        "age_bracket": f"Age: {get_age_bracket(age)}",
        "interests": interests[:4],
        "compatibility": "Hidden",
        "has_photo": False,
        "has_real_name": False,
        "has_socials": False,
        "no_photo": True,
        "no_real_name": True,
        "no_social_media": True,
        "location_sharing_enabled": location_enabled,
        "approximate_location": approx_location,
        "approximate_distance": approx_distance,
        "approximate_region": approx_region,
        "mode": "mystery",
        "mode_label": "Mode A — Mystery Match"
    }

class JoinQueueRequest(BaseModel):
    user_id: str
    mode: str = "mystery"  # "mystery" | "speed" | "vibe"
    vibe: str = "🌙 Late Night Deep Talks"
    duration_minutes: int = 20  # 15 or 20 minutes

class ActivityAnswerRequest(BaseModel):
    user_id: str
    activity_idx: int
    answer: Any

class RevealDecisionRequest(BaseModel):
    user_id: str
    decision: str  # "reveal" | "fade" | "continue" | "friends" | "end_date" | "block_report"

class EndDateDecisionRequest(BaseModel):
    user_id: str
    choice: str  # "continue" | "friends" | "end_date" | "block_report"
    report_reason: Optional[str] = None

class BlindDateChatMessageRequest(BaseModel):
    user_id: str
    text: str

class ExitSafelyRequest(BaseModel):
    user_id: str

# In-memory matchmaking queue: list of { user_id, pseudonym, mode, vibe, joined_at }
matchmaking_queue: List[Dict[str, Any]] = []
# Active Blind Date rooms: room_id -> room dict
active_rooms: Dict[str, Dict[str, Any]] = {}

@router.post("/queue")
async def join_queue(req: JoinQueueRequest):
    db = get_db()
    user = await db.users.find_one({"user_id": req.user_id}) if db is not None else None
    pseudonym = user["pseudonym"] if user else "Ghost"

    # Remove user if already in queue
    global matchmaking_queue
    matchmaking_queue = [q for q in matchmaking_queue if q["user_id"] != req.user_id]

    # Look for another peer in queue
    matched_peer = None
    for idx, candidate in enumerate(matchmaking_queue):
        if candidate["user_id"] != req.user_id:
            matched_peer = matchmaking_queue.pop(idx)
            break

    if matched_peer:
        # Match found! Create a secure blind date room
        room_id = f"bd_{uuid.uuid4().hex[:12]}"
        ghost1 = f"Shadow#{req.user_id[-4:]}"
        ghost2 = f"Phantom#{matched_peer['user_id'][-4:]}"

        matched_user_doc = await db.users.find_one({"user_id": matched_peer["user_id"]}) if db is not None else None
        mystery1 = build_mystery_card(matched_user_doc)
        mystery2 = build_mystery_card(user)

        dur_mins = 5 if req.mode == "speed" else (req.duration_minutes if req.duration_minutes in (15, 20) else 20)
        time_limit_secs = dur_mins * 60
        created_time = time.time()

        room_doc = {
            "room_id": room_id,
            "mode": req.mode,
            "vibe": req.vibe,
            "duration_minutes": dur_mins,
            "time_limit_seconds": time_limit_secs,
            "expires_at": created_time + time_limit_secs,
            "user1": {"user_id": req.user_id, "ghost": ghost1},
            "user2": {"user_id": matched_peer["user_id"], "ghost": ghost2},
            "participants": [req.user_id, matched_peer["user_id"]],
            "mystery_card_for_user1": mystery1,
            "mystery_card_for_user2": mystery2,
            "chemistry": 20,
            "activities": CURATED_ACTIVITIES,
            "current_activity_idx": 0,
            "answers": {str(i): {} for i in range(len(CURATED_ACTIVITIES))},
            "decisions": {},
            "end_decisions": {},
            "chat_messages": [],
            "status": "active",
            "created_at": created_time
        }

        if db is not None:
            await db.blind_date_rooms.insert_one(dict(room_doc))
            room_doc.pop("_id", None)
        active_rooms[room_id] = room_doc

        # Notify User 1
        await ws_manager.send_to_user(req.user_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.matched",
                "room": room_doc,
                "peer_ghost": ghost2,
                "peer_user_id": matched_peer["user_id"],
                "mystery_card": mystery1,
                "timestamp": time.time()
            }
        })

        # Notify User 2 (matched peer)
        await ws_manager.send_to_user(matched_peer["user_id"], {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.matched",
                "room": room_doc,
                "peer_ghost": ghost1,
                "peer_user_id": req.user_id,
                "mystery_card": mystery2,
                "timestamp": time.time()
            }
        })

        return {
            "status": "matched",
            "room_id": room_id,
            "room": room_doc,
            "peer_ghost": ghost2,
            "peer_user_id": matched_peer["user_id"],
            "mystery_card": mystery1
        }

    # Otherwise, wait in queue
    matchmaking_queue.append({
        "user_id": req.user_id,
        "pseudonym": pseudonym,
        "mode": req.mode,
        "vibe": req.vibe,
        "joined_at": time.time()
    })

    return {
        "status": "queued",
        "message": "Searching for an anonymous soulmate in the shadows...",
        "queue_position": len(matchmaking_queue)
    }

@router.delete("/queue/{user_id}")
async def leave_queue(user_id: str):
    global matchmaking_queue
    matchmaking_queue = [q for q in matchmaking_queue if q["user_id"] != user_id]
    return {"status": "left", "user_id": user_id}

@router.get("/room/{room_id}")
async def get_room(room_id: str):
    if room_id in active_rooms:
        return active_rooms[room_id]
    db = get_db()
    if db is not None:
        doc = await db.blind_date_rooms.find_one({"room_id": room_id})
        if doc:
            doc.pop("_id", None)
            return doc
    raise HTTPException(status_code=404, detail="Blind Date room not found")

@router.post("/room/{room_id}/answer")
async def submit_activity_answer(room_id: str, req: ActivityAnswerRequest):
    room = active_rooms.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.blind_date_rooms.find_one({"room_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    act_idx = req.activity_idx
    act_key = str(act_idx)
    if act_key not in room["answers"]:
        room["answers"][act_key] = {}

    target_answers = room["answers"][act_key]
    target_answers[req.user_id] = req.answer

    # Check if both participants answered
    both_answered = len(target_answers) >= 2
    if both_answered:
        room["chemistry"] = min(100, room["chemistry"] + 18)
        # Advance to next activity or to decision phase
        if act_idx + 1 < len(room["activities"]):
            room["current_activity_idx"] = act_idx + 1
        else:
            room["status"] = "decision"

    # Compute Compatibility Puzzle match results
    puzzle_results = compare_puzzle_answers(room["activities"], room["answers"])
    room["puzzle_results"] = puzzle_results

    active_rooms[room_id] = room
    db = get_db()
    if db is not None:
        await db.blind_date_rooms.update_one(
            {"room_id": room_id},
            {"$set": {
                f"answers.{act_key}": target_answers,
                "chemistry": room["chemistry"],
                "current_activity_idx": room["current_activity_idx"],
                "status": room["status"],
                "puzzle_results": puzzle_results
            }}
        )

    # Broadcast real-time update to all room participants
    for p_id in room["participants"]:
        await ws_manager.send_to_user(p_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.activity_update",
                "room_id": room_id,
                "activity_idx": act_idx,
                "both_answered": both_answered,
                "answers": target_answers if both_answered else {req.user_id: "Answered 🔒"},
                "chemistry": room["chemistry"],
                "next_activity_idx": room["current_activity_idx"],
                "status": room["status"],
                "puzzle_results": puzzle_results,
                "timestamp": time.time()
            }
        })

    return {
        "status": "success",
        "both_answered": both_answered,
        "chemistry": room["chemistry"],
        "next_activity_idx": room["current_activity_idx"],
        "room_status": room["status"],
        "puzzle_results": puzzle_results
    }

@router.post("/room/{room_id}/decision")
async def submit_reveal_decision(room_id: str, req: RevealDecisionRequest):
    room = active_rooms.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.blind_date_rooms.find_one({"room_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room["decisions"][req.user_id] = req.decision

    # Check if both made decisions
    is_complete = len(room["decisions"]) >= 2
    outcome = "pending"

    if is_complete:
        user_decisions = list(room["decisions"].values())
        if all(d in ("reveal", "continue") for d in user_decisions):
            outcome = "mutual_reveal"
            room["status"] = "revealed"
            p1, p2 = room["participants"]
            db = get_db()
            if db is not None:
                await db.identity_unlocks.update_one(
                    {"granter_id": p1, "grantee_id": p2},
                    {"$set": {"granter_id": p1, "grantee_id": p2, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
                await db.identity_unlocks.update_one(
                    {"granter_id": p2, "grantee_id": p1},
                    {"$set": {"granter_id": p2, "grantee_id": p1, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
        elif any(d in ("friends", "continue") for d in user_decisions) and not any(d in ("fade", "end_date", "block_report") for d in user_decisions):
            outcome = "friends"
            room["status"] = "friends"
            p1, p2 = room["participants"]
            db = get_db()
            if db is not None:
                await db.identity_unlocks.update_one(
                    {"granter_id": p1, "grantee_id": p2},
                    {"$set": {"granter_id": p1, "grantee_id": p2, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
                await db.identity_unlocks.update_one(
                    {"granter_id": p2, "grantee_id": p1},
                    {"$set": {"granter_id": p2, "grantee_id": p1, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
        elif any(d == "block_report" for d in user_decisions):
            outcome = "blocked"
            room["status"] = "blocked"
        else:
            outcome = "faded"
            room["status"] = "faded"

    active_rooms[room_id] = room
    db = get_db()
    if db is not None:
        await db.blind_date_rooms.update_one(
            {"room_id": room_id},
            {"$set": {"decisions": room["decisions"], "status": room["status"]}}
        )

    # Broadcast decision update
    for p_id in room["participants"]:
        await ws_manager.send_to_user(p_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.decision_update",
                "room_id": room_id,
                "is_complete": is_complete,
                "outcome": outcome,
                "timestamp": time.time()
            }
        })

    return {
        "status": "success",
        "is_complete": is_complete,
        "outcome": outcome,
        "puzzle_results": room.get("puzzle_results")
    }

@router.post("/room/{room_id}/end-date-decision")
async def submit_end_date_decision(room_id: str, req: EndDateDecisionRequest):
    room = active_rooms.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.blind_date_rooms.find_one({"room_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Blind Date room not found")

    if "end_decisions" not in room:
        room["end_decisions"] = {}

    room["end_decisions"][req.user_id] = {
        "choice": req.choice,
        "report_reason": req.report_reason,
        "timestamp": time.time()
    }
    room.setdefault("decisions", {})[req.user_id] = "reveal" if req.choice in ("continue", "friends") else "fade"

    db = get_db()
    is_demo = "bot_cyber_companion" in room.get("participants", [])

    # If block/report chosen, execute immediately
    if req.choice == "block_report":
        room["status"] = "blocked"
        other_participants = [p for p in room["participants"] if p != req.user_id]
        if other_participants and db is not None:
            await db.user_blocks.update_one(
                {"blocker_id": req.user_id, "blocked_id": other_participants[0]},
                {"$set": {
                    "blocker_id": req.user_id,
                    "blocked_id": other_participants[0],
                    "reason": req.report_reason or "Reported during blind date",
                    "created_at": time.time()
                }},
                upsert=True
            )
        active_rooms[room_id] = room
        if db is not None:
            await db.blind_date_rooms.update_one(
                {"room_id": room_id},
                {"$set": {"status": "blocked", "end_decisions": room["end_decisions"]}}
            )
        for p_id in room["participants"]:
            await ws_manager.send_to_user(p_id, {
                "type": "signal",
                "signal": {
                    "signal_type": "blind_date.end_decision_update",
                    "room_id": room_id,
                    "is_complete": True,
                    "outcome": "blocked",
                    "user_choice": req.choice,
                    "timestamp": time.time()
                }
            })
        return {
            "status": "success",
            "is_complete": True,
            "outcome": "blocked",
            "choice": "block_report"
        }

    # If demo bot room, auto-simulate companion matching decision
    if is_demo and req.user_id != "bot_cyber_companion":
        if req.choice == "maybe_later":
            bot_choice = "maybe_later"
        else:
            bot_choice = req.choice if req.choice in ("continue", "friends") else "end_date"
        room["end_decisions"]["bot_cyber_companion"] = {
            "choice": bot_choice,
            "report_reason": None,
            "timestamp": time.time()
        }
        room.setdefault("decisions", {})["bot_cyber_companion"] = "reveal" if bot_choice in ("continue", "friends") else "fade"

    is_complete = len(room["end_decisions"]) >= 2
    outcome = "pending"

    if is_complete:
        choices = [d["choice"] for d in room["end_decisions"].values()]
        p1, p2 = room["participants"]
        if any(c == "block_report" for c in choices):
            outcome = "blocked"
            room["status"] = "blocked"
        elif all(c == "maybe_later" for c in choices):
            outcome = "second_chance"
            room["status"] = "second_chance"
            from .second_chance import SECOND_CHANCE_VAULT
            import uuid
            sc_id = f"sc_{uuid.uuid4().hex[:12]}"
            sc_doc = {
                "second_chance_id": sc_id,
                "source": "blind_date",
                "source_room_id": room_id,
                "participants": [p1, p2],
                "participant_meta": {
                    p1: {"pseudonym": f"Date Partner #{p1[-4:]}"},
                    p2: {"pseudonym": f"Date Partner #{p2[-4:]}"}
                },
                "placed_at": time.time(),
                "status": "dormant",
                "reopen_requests": {p1: False, p2: False},
                "archived_by": {p1: False, p2: False},
                "reopened_at": None,
                "unlocked_chat_id": None
            }
            SECOND_CHANCE_VAULT[sc_id] = sc_doc
            if db is not None:
                await db.second_chance_connections.update_one(
                    {"second_chance_id": sc_id},
                    {"$set": sc_doc},
                    upsert=True
                )
        elif any(c == "end_date" for c in choices):
            outcome = "ended"
            room["status"] = "ended"
        elif all(c == "continue" for c in choices):
            outcome = "continue"
            room["status"] = "continue"
            if db is not None:
                await db.identity_unlocks.update_one(
                    {"granter_id": p1, "grantee_id": p2},
                    {"$set": {"granter_id": p1, "grantee_id": p2, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
                await db.identity_unlocks.update_one(
                    {"granter_id": p2, "grantee_id": p1},
                    {"$set": {"granter_id": p2, "grantee_id": p1, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
        else: # both friends or one continue + one friends
            outcome = "friends"
            room["status"] = "friends"
            if db is not None:
                await db.identity_unlocks.update_one(
                    {"granter_id": p1, "grantee_id": p2},
                    {"$set": {"granter_id": p1, "grantee_id": p2, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )
                await db.identity_unlocks.update_one(
                    {"granter_id": p2, "grantee_id": p1},
                    {"$set": {"granter_id": p2, "grantee_id": p1, "level": 2, "updated_at": time.time()}},
                    upsert=True
                )

    active_rooms[room_id] = room
    if db is not None:
        await db.blind_date_rooms.update_one(
            {"room_id": room_id},
            {"$set": {"end_decisions": room["end_decisions"], "status": room["status"]}}
        )

    # Broadcast decision update
    for p_id in room["participants"]:
        await ws_manager.send_to_user(p_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.end_decision_update",
                "room_id": room_id,
                "is_complete": is_complete,
                "outcome": outcome,
                "timestamp": time.time()
            }
        })

    return {
        "status": "success",
        "is_complete": is_complete,
        "outcome": outcome,
        "puzzle_results": room.get("puzzle_results")
    }

@router.post("/room/{room_id}/exit-safely")
async def exit_date_safely(room_id: str, req: ExitSafelyRequest):
    """
    15. 🚪 Exit Anytime
    A very important safety feature.
    Allows either participant to exit the Blind Date at any moment.
    No explanation required.
    The session is cleanly terminated.
    The other person simply sees: 'The Blind Date has ended.'
    """
    room = active_rooms.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.blind_date_rooms.find_one({"room_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Blind date chamber not found")

    now = time.time()
    room["status"] = "ended_safely"
    room["ended_safely_by"] = req.user_id
    room["ended_at"] = now
    active_rooms[room_id] = room

    db = get_db()
    if db is not None:
        await db.blind_date_rooms.update_one(
            {"room_id": room_id},
            {"$set": {
                "status": "ended_safely",
                "ended_safely_by": req.user_id,
                "ended_at": now
            }}
        )

    # Broadcast to both participants
    participants = room.get("participants", [])
    for p_id in participants:
        is_leaver = (p_id == req.user_id)
        # The other person simply sees: "The Blind Date has ended."
        msg_text = (
            "You have safely exited the Blind Date. No explanation required."
            if is_leaver
            else "The Blind Date has ended."
        )
        await ws_manager.send_to_user(p_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.ended_safely",
                "room_id": room_id,
                "ended_by": req.user_id,
                "is_leaver": is_leaver,
                "message": msg_text,
                "timestamp": now
            }
        })

    return {
        "status": "exited_safely",
        "room_id": room_id,
        "message": "You have safely exited the Blind Date. No explanation required.",
        "peer_message": "The Blind Date has ended."
    }

@router.post("/room/{room_id}/chat")
async def send_blind_date_chat(room_id: str, req: BlindDateChatMessageRequest):
    room = active_rooms.get(room_id)
    if not room:
        db = get_db()
        if db is not None:
            room = await db.blind_date_rooms.find_one({"room_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Blind date chamber not found")

    sender_ghost = "Shadow"
    if req.user_id == room.get("user1", {}).get("user_id"):
        sender_ghost = room.get("user1", {}).get("ghost", "Shadow")
    elif req.user_id == room.get("user2", {}).get("user_id"):
        sender_ghost = room.get("user2", {}).get("ghost", "Phantom")

    # Contact Protection Guard: Don't expose phone number, email, exact location, device information
    contact_audit = sanitize_contact_leaks(req.text.strip())

    msg_id = f"bd_msg_{uuid.uuid4().hex[:8]}"
    msg_obj = {
        "message_id": msg_id,
        "sender_id": req.user_id,
        "ghost_sender": sender_ghost,
        "text": contact_audit["sanitized_text"],
        "is_contact_protected": not contact_audit["is_safe"],
        "contact_leaks_shielded": contact_audit["detected_leaks"],
        "contact_warning": contact_audit["warning"],
        "timestamp": time.time()
    }

    if "chat_messages" not in room:
        room["chat_messages"] = []
    room["chat_messages"].append(msg_obj)

    # Broadcast message to participants
    for p_id in room["participants"]:
        await ws_manager.send_to_user(p_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.chat_message",
                "room_id": room_id,
                "message": msg_obj,
                "timestamp": time.time()
            }
        })

    # If demo bot room, simulate companion reply
    is_demo = "bot_cyber_companion" in room.get("participants", [])
    bot_reply_obj = None
    if is_demo and req.user_id != "bot_cyber_companion":
        bot_ghost = room.get("user2", {}).get("ghost", "Phantom#8901")
        replies = [
            "Haha I completely agree! It's so rare to find someone who gets this vibe.",
            "That's so interesting! Tell me more about what inspired that.",
            "I was hoping you'd say that! We seem to be on the exact same wavelength.",
            "Time is flying by in this date! It feels like 20 minutes isn't enough.",
            "Honestly loving this conversation. Feels so refreshing without any superficial distractions."
        ]
        bot_reply_obj = {
            "message_id": f"bd_msg_{uuid.uuid4().hex[:8]}",
            "sender_id": "bot_cyber_companion",
            "ghost_sender": bot_ghost,
            "text": random.choice(replies),
            "timestamp": time.time() + 0.5
        }
        room["chat_messages"].append(bot_reply_obj)
        await ws_manager.send_to_user(req.user_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.chat_message",
                "room_id": room_id,
                "message": bot_reply_obj,
                "timestamp": time.time()
            }
        })

    active_rooms[room_id] = room
    db = get_db()
    if db is not None:
        await db.blind_date_rooms.update_one(
            {"room_id": room_id},
            {"$push": {"chat_messages": {"$each": [msg_obj] + ([bot_reply_obj] if bot_reply_obj else [])}}}
        )

    return {
        "status": "success",
        "message": msg_obj,
        "bot_reply": bot_reply_obj,
        "total_messages": len(room["chat_messages"])
    }

class ComparePuzzleRequest(BaseModel):
    user1_answers: Dict[str, str]
    user2_answers: Dict[str, str]

@router.get("/puzzle/questions")
async def get_puzzle_questions():
    return {
        "status": "success",
        "total": len(COMPATIBILITY_PUZZLE_QUESTIONS),
        "questions": COMPATIBILITY_PUZZLE_QUESTIONS
    }

@router.post("/puzzle/compare")
async def compare_puzzle_endpoint(req: ComparePuzzleRequest):
    formatted_answers = {}
    for idx in range(len(COMPATIBILITY_PUZZLE_QUESTIONS)):
        key = str(idx)
        formatted_answers[key] = {
            "u1": req.user1_answers.get(key, ""),
            "u2": req.user2_answers.get(key, "")
        }
    results = compare_puzzle_answers(COMPATIBILITY_PUZZLE_QUESTIONS, formatted_answers)
    return {
        "status": "success",
        **results
    }

# Interactive Demo Simulation Endpoint: Instant match with an AI Shadow Persona for solo testing
@router.post("/instant-demo-match")
async def instant_demo_match(
    user_id: str = Query(...),
    vibe: str = "🌙 Late Night Deep Talks",
    mode: str = "mystery",
    duration_minutes: int = 20
):
    db = get_db()
    bot_id = "bot_cyber_companion"

    # Ensure bot user exists in DB
    bot_profile = {
        "ghost_id": "Phantom#8901",
        "nickname": "✨ Lyra",
        "avatar_emoji": "✨",
        "avatar_color": "#EC4899",
        "age": 22,
        "interests": ["🎮 Gaming", "🎵 Music", "☕ Coffee"],
        "vibe": "Stargazer • Late-night coder • Coffee connoisseur",
        "first_name": "Lyra",
        "photo_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
        "socials": {"instagram": "@lyra_in_the_sky"},
        "location_sharing_enabled": True,
        "approximate_region": "Delhi NCR",
        "approximate_distance_km": 8
    }

    if db is not None:
        bot = await db.users.find_one({"user_id": bot_id})
        if not bot:
            await db.users.insert_one({
                "user_id": bot_id,
                "pseudonym": "EchoVanguard",
                "ed25519_identity_pub": "1111222233334444555566667777888811112222333344445555666677778888",
                "x25519_signed_prekey": "9999888877776666555544443333222299998888777766665555444433332222",
                "signed_prekey_sig": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
                "one_time_prekeys": [],
                "profile": bot_profile,
                "created_at": time.time(),
                "last_seen": time.time(),
                "is_online": True
            })
        else:
            bot_profile = bot.get("profile", bot_profile)
    
    user_doc = await db.users.find_one({"user_id": user_id}) if db is not None else None
    bot_doc = {"profile": bot_profile}

    room_id = f"bd_{uuid.uuid4().hex[:12]}"
    ghost1 = f"Shadow#{user_id[-4:]}"
    ghost2 = "Phantom#8901"

    mystery1 = build_mystery_card(bot_doc)
    mystery2 = build_mystery_card(user_doc)

    bot_answers = {
        "0": "🌙 Midnight",
        "1": "🛋️ Introvert evening",
        "2": "☕ Coffee",
        "3": "✈️ Travel with friends",
        "4": "🎮 Build dream gaming rig & tech vault",
        "5": "🎮 Gaming marathon"
    }
    demo_answers = {str(i): {bot_id: bot_answers.get(str(i), "")} for i in range(len(CURATED_ACTIVITIES))}
    initial_puzzle = compare_puzzle_answers(CURATED_ACTIVITIES, demo_answers)

    dur_mins = 5 if mode == "speed" else (duration_minutes if duration_minutes in (15, 20) else 20)
    time_limit_secs = dur_mins * 60
    created_time = time.time()

    initial_messages = [
        {
            "message_id": f"bd_msg_init_0",
            "sender_id": bot_id,
            "ghost_sender": ghost2,
            "text": f"Hey! 🕶️ Welcome to our {dur_mins}-minute blind date. So curious to see what we have in common!",
            "timestamp": created_time
        }
    ]

    room_doc = {
        "room_id": room_id,
        "mode": mode,
        "vibe": vibe,
        "duration_minutes": dur_mins,
        "time_limit_seconds": time_limit_secs,
        "expires_at": created_time + time_limit_secs,
        "user1": {"user_id": user_id, "ghost": ghost1},
        "user2": {"user_id": bot_id, "ghost": ghost2},
        "participants": [user_id, bot_id],
        "mystery_card_for_user1": mystery1,
        "mystery_card_for_user2": mystery2,
        "chemistry": 30,
        "activities": CURATED_ACTIVITIES,
        "current_activity_idx": 0,
        "answers": demo_answers,
        "puzzle_results": initial_puzzle,
        "decisions": {bot_id: "reveal"},
        "end_decisions": {},
        "chat_messages": initial_messages,
        "status": "active",
        "created_at": created_time
    }

    if db is not None:
        await db.blind_date_rooms.insert_one(dict(room_doc))
        room_doc.pop("_id", None)
    active_rooms[room_id] = room_doc

    return {
        "status": "matched",
        "room_id": room_id,
        "room": room_doc,
        "peer_ghost": ghost2,
        "peer_user_id": bot_id,
        "mystery_card": mystery1,
        "puzzle_results": initial_puzzle
    }


# ---------------------------------------------------------------------------
# 8. 🎲 Blind Date Mini Games Suite: Game 1 — This or That (Simultaneous Answering)
# ---------------------------------------------------------------------------

MINI_GAME_THIS_OR_THAT_ROUNDS = [
    {
        "round_idx": 0,
        "id": "round_pizza_burger",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 1",
        "question": "Pizza 🍕 or Burger 🍔?",
        "options": ["🍕 Pizza", "🍔 Burger"],
        "option_a": "🍕 Pizza",
        "option_b": "🍔 Burger",
        "match_topic": "You both chose Pizza 🍕! Deep dish, wood-fired thin crust, or stuffed crust — what's your ultimate topping combination?",
        "clash_topic": "Playful food clash! Can a smash burger ever beat a fresh hot slice of pizza?",
        "tag_a": "🍕 Pizza",
        "tag_b": "🍔 Burger",
        "chemistry_boost": 20
    },
    {
        "round_idx": 1,
        "id": "round_sunrise_midnight",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 2",
        "question": "Sunrise 🌅 or Midnight 🌙?",
        "options": ["🌅 Sunrise", "🌙 Midnight"],
        "option_a": "🌅 Sunrise",
        "option_b": "🌙 Midnight",
        "match_topic": "Rhythm resonance! What thoughts or creative passions keep your mind alive during late midnight hours?",
        "clash_topic": "Early bird meets night owl! How do you handle opposite circadian rhythms?",
        "tag_a": "🌅 Early mornings",
        "tag_b": "🌙 Late nights",
        "chemistry_boost": 18
    },
    {
        "round_idx": 2,
        "id": "round_coffee_chai",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 3",
        "question": "Coffee ☕ or Chai 🫖?",
        "options": ["☕ Coffee", "🫖 Chai"],
        "option_a": "☕ Coffee",
        "option_b": "🫖 Chai",
        "match_topic": "Beverage sync! What's the secret ingredient or roast in your perfect morning brew?",
        "clash_topic": "The legendary brew debate! Dark roasted espresso vs aromatic ginger elaichi chai?",
        "tag_a": "☕ Coffee",
        "tag_b": "🫖 Chai",
        "chemistry_boost": 18
    },
    {
        "round_idx": 3,
        "id": "round_travel",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 4",
        "question": "Travel alone 🎒 or With friends ✈️?",
        "options": ["🎒 Travel alone", "✈️ Travel with friends"],
        "option_a": "🎒 Travel alone",
        "option_b": "✈️ Travel with friends",
        "match_topic": "Wanderlust alignment! What's the wildest trip or dream destination on your bucket list?",
        "clash_topic": "Solo introspection vs group road trips — which creates the most unforgettable stories?",
        "tag_a": "🎒 Solo travel",
        "tag_b": "✈️ Travel with friends",
        "chemistry_boost": 18
    },
    {
        "round_idx": 4,
        "id": "round_evening",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 5",
        "question": "Cozy evening 🛋️ or Wild party 🎉?",
        "options": ["🛋️ Cozy evening", "🎉 Wild party"],
        "option_a": "🛋️ Cozy evening",
        "option_b": "🎉 Wild party",
        "match_topic": "Vibe sync! What's your go-to comfort show, album, or routine when recharging?",
        "clash_topic": "Introvert sanctuary vs dancefloor energy! Can an introvert and party lover balance weekend plans?",
        "tag_a": "🛋️ Introvert evening",
        "tag_b": "🎉 Party night",
        "chemistry_boost": 18
    },
    {
        "round_idx": 5,
        "id": "round_weekend",
        "game_name": "Game 1 — This or That",
        "title": "🎲 Game 1 — This or That • Round 6",
        "question": "Gaming marathon 🎮 or Nature adventure 🌲?",
        "options": ["🎮 Gaming marathon", "🌲 Nature adventure"],
        "option_a": "🎮 Gaming marathon",
        "option_b": "🌲 Nature adventure",
        "match_topic": "Passion resonance! What game storyline or mountain summit left the deepest mark on you?",
        "clash_topic": "Digital cyberpunk worlds vs wild forest trails! Could you convince your partner to try yours?",
        "tag_a": "🎮 Gaming marathon",
        "tag_b": "🌲 Nature adventure",
        "chemistry_boost": 18
    }
]

# Game 2 — Two Truths & A Lie Defaults
DEFAULT_TWO_TRUTHS_STATEMENTS = [
    "I've travelled alone.",
    "I hate coffee.",
    "I've broken a bone."
]

# Game 3 — Would You Rather Deck
MINI_GAME_WOULD_YOU_RATHER_ROUNDS = [
    {
        "round_idx": 0,
        "id": "wyr_travel_city",
        "game_name": "Game 3 — Would You Rather",
        "title": "🌍 Game 3 — Would You Rather",
        "question": "Would you rather:",
        "option_a": "🌍 Travel the world",
        "option_b": "🏠 Live in your dream city",
        "options": ["🌍 Travel the world", "🏠 Live in your dream city"],
        "match_topic_a": "You both chose to travel the world 🌍! Which country or continent is first on your bucket list?",
        "match_topic_b": "You both chose to live in your dream city 🏠! What city is your sanctuary, and how is your dream home designed?",
        "clash_topic": "Wanderlust vs Roots! One wants to travel the world 🌍 while the other wants their dream sanctuary 🏠. What inspired your choice?",
        "chemistry_boost": 10
    },
    {
        "round_idx": 1,
        "id": "wyr_time_teleport",
        "game_name": "Game 3 — Would You Rather",
        "title": "⏳ Game 3 — Would You Rather • Powers",
        "question": "Would you rather:",
        "option_a": "⏰ Pause time whenever you want",
        "option_b": "🚀 Teleport anywhere instantly",
        "options": ["⏰ Pause time whenever you want", "🚀 Teleport anywhere instantly"],
        "match_topic_a": "Time manipulation allies! What would you do first while the entire universe is frozen?",
        "match_topic_b": "Instant jetsetters! What exotic place would you teleport to right this second?",
        "clash_topic": "Time master vs Instant explorer! Would you rather conquer seconds or conquer distances?",
        "chemistry_boost": 10
    },
    {
        "round_idx": 2,
        "id": "wyr_language_music",
        "game_name": "Game 3 — Would You Rather",
        "title": "🎵 Game 3 — Would You Rather • Mastery",
        "question": "Would you rather:",
        "option_a": "🧠 Speak every language on Earth fluently",
        "option_b": "🎸 Master every musical instrument flawlessly",
        "options": ["🧠 Speak every language on Earth fluently", "🎸 Master every musical instrument flawlessly"],
        "match_topic_a": "Global communicators! Which language or ancient script would you read first?",
        "match_topic_b": "Musical geniuses! What instrument would be the soundtrack to your soul?",
        "clash_topic": "Words vs Melody! Can speaking every language unlock deeper bonds than mastering music?",
        "chemistry_boost": 10
    }
]

# Game 4 — Guess Me Deck
MINI_GAME_GUESS_ME_PROMPTS = [
    {
        "prompt_idx": 0,
        "id": "gm_genre",
        "game_name": "Game 4 — Guess Me",
        "title": "🔮 Game 4 — Guess Me",
        "prompt": "Guess your match's favourite genre.",
        "options": [
            "Horror",
            "Sci-Fi",
            "Romance",
            "Comedy",
            "Thriller",
            "Fantasy"
        ],
        "default_bot_actual": "Horror",
        "default_bot_guess": "Horror",
        "match_topic": "You read their mind! What horror movie genuinely traumatized you or kept you up at night?",
        "clash_topic": "Different tastes! What's the one movie from your genre that could convert anyone?",
        "chemistry_boost": 10
    },
    {
        "prompt_idx": 1,
        "id": "gm_superpower",
        "game_name": "Game 4 — Guess Me",
        "title": "🔮 Game 4 — Guess Me • Secret Superpower",
        "prompt": "Guess your match's dream superpower.",
        "options": [
            "Mind reading",
            "Invisibility",
            "Time travel",
            "Flight",
            "Telekinesis"
        ],
        "default_bot_actual": "Mind reading",
        "default_bot_guess": "Mind reading",
        "match_topic": "Mind reader confirmed! Would you actually want to know what strangers think about you?",
        "clash_topic": "Superpower debate! How would your superpower change your daily routine?",
        "chemistry_boost": 10
    }
]

mini_game_sessions: Dict[str, dict] = {}

class MiniGameAnswerRequest(BaseModel):
    user_id: str
    peer_id: str
    round_idx: int = 0
    answer: str

class MiniGameNextRoundRequest(BaseModel):
    user_id: str
    peer_id: str
    next_round_idx: Optional[int] = None

class Game2SubmitRequest(BaseModel):
    user_id: str
    peer_id: str
    statements: List[str]
    lie_index: int

class Game2GuessRequest(BaseModel):
    user_id: str
    peer_id: str
    guessed_lie_index: int

class Game3AnswerRequest(BaseModel):
    user_id: str
    peer_id: str
    round_idx: int = 0
    answer: str

class Game4SubmitRequest(BaseModel):
    user_id: str
    peer_id: str
    prompt_idx: int = 0
    my_actual: str
    my_guess_for_peer: str

@router.get("/mini-games/full-suite")
async def get_mini_games_full_suite():
    return {
        "games": [
            {
                "id": "game1",
                "number": 1,
                "name": "Game 1 — This or That",
                "tagline": "Pizza 🍕 or Burger 🍔? Both answer simultaneously.",
                "total_rounds": len(MINI_GAME_THIS_OR_THAT_ROUNDS),
                "preview": "Pizza 🍕 vs Burger 🍔"
            },
            {
                "id": "game2",
                "number": 2,
                "name": "Game 2 — Two Truths & A Lie",
                "tagline": "Each person submits 3 statements; other person guesses the lie.",
                "default_statements": DEFAULT_TWO_TRUTHS_STATEMENTS,
                "preview": "1. Travelled alone • 2. Hate coffee • 3. Broken bone"
            },
            {
                "id": "game3",
                "number": 3,
                "name": "Game 3 — Would You Rather",
                "tagline": "Would you rather: 🌍 Travel the world OR 🏠 Live in your dream city?",
                "total_rounds": len(MINI_GAME_WOULD_YOU_RATHER_ROUNDS),
                "preview": "🌍 Travel world vs 🏠 Dream city"
            },
            {
                "id": "game4",
                "number": 4,
                "name": "Game 4 — Guess Me",
                "tagline": "Guess your match's favourite genre. Reveal: Your guess vs Actual! (+10 Chemistry)",
                "total_prompts": len(MINI_GAME_GUESS_ME_PROMPTS),
                "preview": "Guess favourite genre ➔ Actual: Horror 😳 (+10 Chem)"
            }
        ]
    }

@router.get("/mini-games/rounds")
async def get_mini_game_rounds():
    return {
        "game_id": "this_or_that",
        "game_name": "Game 1 — This or That",
        "tagline": "Instead of saying 'Hi', play activities. Both answer simultaneously!",
        "total_rounds": len(MINI_GAME_THIS_OR_THAT_ROUNDS),
        "rounds": MINI_GAME_THIS_OR_THAT_ROUNDS
    }

@router.get("/mini-games/status")
async def get_mini_game_status(user_id: str = Query(...), peer_id: str = Query(...)):
    pair_id = ":".join(sorted([user_id, peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "history": []
    })

    round_idx = session.get("round_idx", 0)
    current_round = MINI_GAME_THIS_OR_THAT_ROUNDS[round_idx % len(MINI_GAME_THIS_OR_THAT_ROUNDS)]

    round_answers = session.setdefault("answers", {}).setdefault(str(round_idx), {})
    my_answer = round_answers.get(user_id)
    has_peer_answered = peer_id in round_answers
    both_answered = len(round_answers) >= 2

    # Answers remain sealed until BOTH have submitted!
    peer_answer = round_answers.get(peer_id) if both_answered else None
    is_match = False
    spark_topic = None

    if both_answered:
        ans1 = round_answers.get(user_id)
        ans2 = round_answers.get(peer_id)
        is_match = (ans1 == ans2)
        spark_topic = current_round["match_topic"] if is_match else current_round["clash_topic"]

    return {
        "pair_id": pair_id,
        "round_idx": round_idx,
        "total_rounds": len(MINI_GAME_THIS_OR_THAT_ROUNDS),
        "current_round": current_round,
        "my_answer": my_answer,
        "has_peer_answered": has_peer_answered,
        "both_answered": both_answered,
        "peer_answer": peer_answer,
        "is_match": is_match,
        "spark_topic": spark_topic,
        "chemistry_boost": current_round["chemistry_boost"]
    }

@router.post("/mini-games/answer")
async def submit_mini_game_answer(req: MiniGameAnswerRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": req.round_idx,
        "answers": {},
        "history": []
    })

    round_idx = req.round_idx
    session["round_idx"] = round_idx
    round_answers = session.setdefault("answers", {}).setdefault(str(round_idx), {})
    round_answers[req.user_id] = req.answer

    current_round = MINI_GAME_THIS_OR_THAT_ROUNDS[round_idx % len(MINI_GAME_THIS_OR_THAT_ROUNDS)]

    # If peer is a companion bot, auto-answer simultaneously
    is_bot = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_bot and req.peer_id not in round_answers:
        bot_choices = {
            0: "🍕 Pizza",
            1: "🌙 Midnight",
            2: "☕ Coffee",
            3: "✈️ Travel with friends",
            4: "🛋️ Cozy evening",
            5: "🎮 Gaming marathon"
        }
        round_answers[req.peer_id] = bot_choices.get(round_idx, current_round["options"][0])

    both_answered = len(round_answers) >= 2
    peer_answer = round_answers.get(req.peer_id) if both_answered else None
    is_match = False
    spark_topic = None

    if both_answered:
        ans1 = round_answers.get(req.user_id)
        ans2 = round_answers.get(req.peer_id)
        is_match = (ans1 == ans2)
        spark_topic = current_round["match_topic"] if is_match else current_round["clash_topic"]

        # Real-time WebSocket signal: unseal answers simultaneously
        for uid in [req.user_id, req.peer_id]:
            await ws_manager.send_to_user(uid, {
                "type": "signal",
                "signal": {
                    "signal_type": "mini_game.answer_unsealed",
                    "pair_id": pair_id,
                    "round_idx": round_idx,
                    "both_answered": True,
                    "answers": round_answers,
                    "is_match": is_match,
                    "spark_topic": spark_topic,
                    "timestamp": time.time()
                }
            })

    return {
        "status": "success",
        "round_idx": round_idx,
        "my_answer": req.answer,
        "both_answered": both_answered,
        "peer_answer": peer_answer,
        "is_match": is_match,
        "spark_topic": spark_topic,
        "current_round": current_round
    }

@router.post("/mini-games/next-round")
async def next_mini_game_round(req: MiniGameNextRoundRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "history": []
    })

    next_idx = req.next_round_idx if req.next_round_idx is not None else session.get("round_idx", 0) + 1
    session["round_idx"] = next_idx % len(MINI_GAME_THIS_OR_THAT_ROUNDS)

    for uid in [req.user_id, req.peer_id]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "mini_game.round_changed",
                "pair_id": pair_id,
                "round_idx": session["round_idx"],
                "timestamp": time.time()
            }
        })

    return {
        "status": "next_round",
        "round_idx": session["round_idx"],
        "current_round": MINI_GAME_THIS_OR_THAT_ROUNDS[session["round_idx"]]
    }

@router.post("/mini-games/reset")
async def reset_mini_game_session(user_id: str = Query(...), peer_id: str = Query(...)):
    pair_id = ":".join(sorted([user_id, peer_id]))
    mini_game_sessions[pair_id] = {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "history": []
    }
    return {"status": "reset", "round_idx": 0}


# ==========================================
# GAME 2 — TWO TRUTHS & A LIE
# ==========================================

@router.get("/mini-games/game2/state")
async def get_game2_state(user_id: str = Query(...), peer_id: str = Query(...)):
    pair_id = ":".join(sorted([user_id, peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g2 = session.setdefault("game2", {"submissions": {}, "guesses": {}})

    # Auto-populate bot companion statements if testing with demo bot
    is_bot = peer_id.startswith("bot_") or peer_id.startswith("companion_")
    if is_bot and peer_id not in g2["submissions"]:
        g2["submissions"][peer_id] = {
            "statements": list(DEFAULT_TWO_TRUTHS_STATEMENTS),
            "lie_index": 1,  # "I hate coffee." is the lie
            "submitted_at": time.time()
        }

    my_sub = g2["submissions"].get(user_id)
    peer_sub = g2["submissions"].get(peer_id)
    my_guess = g2["guesses"].get(user_id)
    peer_guess = g2["guesses"].get(peer_id)

    # Obfuscate peer's lie_index until user has guessed
    peer_statements = peer_sub.get("statements") if peer_sub else None
    has_user_guessed = my_guess is not None
    peer_lie_revealed = peer_sub.get("lie_index") if (has_user_guessed and peer_sub) else None

    is_user_correct = False
    spark_topic = None
    if has_user_guessed and peer_sub:
        is_user_correct = (my_guess == peer_sub.get("lie_index"))
        if is_user_correct:
            actual_lie = peer_sub["statements"][peer_sub["lie_index"]]
            spark_topic = f"🎯 Lie detected! '{actual_lie}' was the lie! What's the true story behind your travels?"
        else:
            actual_lie = peer_sub["statements"][peer_sub["lie_index"]]
            spark_topic = f"🎭 Fooled you! '{actual_lie}' was actually the lie! Can you believe it?"

    return {
        "pair_id": pair_id,
        "has_my_submission": my_sub is not None,
        "my_statements": my_sub.get("statements") if my_sub else None,
        "my_lie_index": my_sub.get("lie_index") if my_sub else None,
        "has_peer_submitted": peer_sub is not None,
        "peer_statements": peer_statements,
        "has_user_guessed": has_user_guessed,
        "my_guess": my_guess,
        "peer_lie_revealed": peer_lie_revealed,
        "is_user_correct": is_user_correct,
        "chemistry_awarded": 10 if is_user_correct else 5,
        "spark_topic": spark_topic,
        "default_template": DEFAULT_TWO_TRUTHS_STATEMENTS
    }

@router.post("/mini-games/game2/submit")
async def submit_game2_statements(req: Game2SubmitRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g2 = session.setdefault("game2", {"submissions": {}, "guesses": {}})

    g2["submissions"][req.user_id] = {
        "statements": req.statements,
        "lie_index": req.lie_index,
        "submitted_at": time.time()
    }

    # If peer is a companion bot, ensure bot has statements and bot guesses user's lie
    is_bot = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_bot:
        if req.peer_id not in g2["submissions"]:
            g2["submissions"][req.peer_id] = {
                "statements": list(DEFAULT_TWO_TRUTHS_STATEMENTS),
                "lie_index": 1,
                "submitted_at": time.time()
            }
        g2["guesses"][req.peer_id] = req.lie_index  # Bot makes smart guess

    return {
        "status": "submitted",
        "has_peer_submitted": req.peer_id in g2["submissions"],
        "peer_statements": g2["submissions"].get(req.peer_id, {}).get("statements")
    }

@router.post("/mini-games/game2/guess")
async def guess_game2_lie(req: Game2GuessRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g2 = session.setdefault("game2", {"submissions": {}, "guesses": {}})

    is_bot = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_bot and req.peer_id not in g2["submissions"]:
        g2["submissions"][req.peer_id] = {
            "statements": list(DEFAULT_TWO_TRUTHS_STATEMENTS),
            "lie_index": 1,
            "submitted_at": time.time()
        }

    peer_sub = g2["submissions"].get(req.peer_id)
    if not peer_sub:
        raise HTTPException(status_code=400, detail="Peer has not submitted their 3 statements yet!")

    g2["guesses"][req.user_id] = req.guessed_lie_index
    actual_lie_idx = peer_sub.get("lie_index")
    is_correct = (req.guessed_lie_index == actual_lie_idx)
    actual_lie_str = peer_sub["statements"][actual_lie_idx]

    if is_correct:
        spark_topic = f"🎯 Lie detected! '{actual_lie_str}' was the lie! What's the true story behind your travels?"
        reveal_text = f"🎯 You caught the lie! '{actual_lie_str}' was the lie!\n+10 Chemistry"
    else:
        spark_topic = f"🎭 Fooled you! '{actual_lie_str}' was actually the lie! Can you believe it?"
        reveal_text = f"🎭 Fooled you! '{actual_lie_str}' was actually the lie!\n+5 Chemistry"

    # Signal peer
    for uid in [req.user_id, req.peer_id]:
        await ws_manager.send_to_user(uid, {
            "type": "signal",
            "signal": {
                "signal_type": "mini_game.game2_revealed",
                "guesser_id": req.user_id,
                "is_correct": is_correct,
                "actual_lie_index": actual_lie_idx,
                "actual_lie": actual_lie_str,
                "spark_topic": spark_topic,
                "timestamp": time.time()
            }
        })

    return {
        "status": "guessed",
        "is_correct": is_correct,
        "guessed_index": req.guessed_lie_index,
        "actual_lie_index": actual_lie_idx,
        "actual_lie": actual_lie_str,
        "chemistry_awarded": 10 if is_correct else 5,
        "reveal_text": reveal_text,
        "spark_topic": spark_topic
    }

# ==========================================
# GAME 3 — WOULD YOU RATHER
# ==========================================

@router.get("/mini-games/game3/rounds")
async def get_game3_rounds():
    return {
        "game_id": "would_you_rather",
        "game_name": "Game 3 — Would You Rather",
        "total_rounds": len(MINI_GAME_WOULD_YOU_RATHER_ROUNDS),
        "rounds": MINI_GAME_WOULD_YOU_RATHER_ROUNDS
    }

@router.get("/mini-games/game3/status")
async def get_game3_status(user_id: str = Query(...), peer_id: str = Query(...)):
    pair_id = ":".join(sorted([user_id, peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g3 = session.setdefault("game3", {"round_idx": 0, "answers": {}})
    round_idx = g3.get("round_idx", 0)
    current_round = MINI_GAME_WOULD_YOU_RATHER_ROUNDS[round_idx % len(MINI_GAME_WOULD_YOU_RATHER_ROUNDS)]

    round_answers = g3.setdefault("answers", {}).setdefault(str(round_idx), {})
    my_answer = round_answers.get(user_id)
    has_peer_answered = peer_id in round_answers
    both_answered = len(round_answers) >= 2
    peer_answer = round_answers.get(peer_id) if both_answered else None

    is_match = False
    spark_topic = None
    if both_answered:
        is_match = (round_answers.get(user_id) == round_answers.get(peer_id))
        if is_match:
            spark_topic = current_round["match_topic_a"] if my_answer == current_round["option_a"] else current_round["match_topic_b"]
        else:
            spark_topic = current_round["clash_topic"]

    return {
        "pair_id": pair_id,
        "round_idx": round_idx,
        "total_rounds": len(MINI_GAME_WOULD_YOU_RATHER_ROUNDS),
        "current_round": current_round,
        "my_answer": my_answer,
        "has_peer_answered": has_peer_answered,
        "both_answered": both_answered,
        "peer_answer": peer_answer,
        "is_match": is_match,
        "spark_topic": spark_topic,
        "chemistry_boost": current_round["chemistry_boost"]
    }

@router.post("/mini-games/game3/answer")
async def submit_game3_answer(req: Game3AnswerRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g3 = session.setdefault("game3", {"round_idx": 0, "answers": {}})
    round_idx = req.round_idx
    g3["round_idx"] = round_idx
    round_answers = g3.setdefault("answers", {}).setdefault(str(round_idx), {})
    round_answers[req.user_id] = req.answer

    current_round = MINI_GAME_WOULD_YOU_RATHER_ROUNDS[round_idx % len(MINI_GAME_WOULD_YOU_RATHER_ROUNDS)]

    # If peer is a companion bot, auto-answer
    is_bot = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_bot and req.peer_id not in round_answers:
        round_answers[req.peer_id] = current_round["option_a"]  # Bot selects 🌍 Travel the world

    both_answered = len(round_answers) >= 2
    peer_answer = round_answers.get(req.peer_id) if both_answered else None
    is_match = False
    spark_topic = None

    if both_answered:
        ans1 = round_answers.get(req.user_id)
        ans2 = round_answers.get(req.peer_id)
        is_match = (ans1 == ans2)
        if is_match:
            spark_topic = current_round["match_topic_a"] if ans1 == current_round["option_a"] else current_round["match_topic_b"]
        else:
            spark_topic = current_round["clash_topic"]

    return {
        "status": "success",
        "round_idx": round_idx,
        "my_answer": req.answer,
        "both_answered": both_answered,
        "peer_answer": peer_answer,
        "is_match": is_match,
        "spark_topic": spark_topic,
        "current_round": current_round
    }

# ==========================================
# GAME 4 — GUESS ME
# ==========================================

@router.get("/mini-games/game4/prompts")
async def get_game4_prompts():
    return {
        "game_id": "guess_me",
        "game_name": "Game 4 — Guess Me",
        "total_prompts": len(MINI_GAME_GUESS_ME_PROMPTS),
        "prompts": MINI_GAME_GUESS_ME_PROMPTS
    }

@router.get("/mini-games/game4/status")
async def get_game4_status(user_id: str = Query(...), peer_id: str = Query(...)):
    pair_id = ":".join(sorted([user_id, peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g4 = session.setdefault("game4", {"prompt_idx": 0, "submissions": {}})
    prompt_idx = g4.get("prompt_idx", 0)
    current_prompt = MINI_GAME_GUESS_ME_PROMPTS[prompt_idx % len(MINI_GAME_GUESS_ME_PROMPTS)]

    my_sub = g4.setdefault("submissions", {}).get(user_id)
    peer_sub = g4["submissions"].get(peer_id)

    is_bot = peer_id.startswith("bot_") or peer_id.startswith("companion_")
    if is_bot and peer_id not in g4["submissions"]:
        g4["submissions"][peer_id] = {
            "actual": current_prompt["default_bot_actual"],
            "guess_for_peer": current_prompt["default_bot_guess"]
        }
        peer_sub = g4["submissions"][peer_id]

    both_submitted = (my_sub is not None) and (peer_sub is not None)

    is_correct = False
    reveal_card = None
    spark_topic = None

    if both_submitted:
        user_guess = my_sub.get("guess_for_peer")
        peer_actual = peer_sub.get("actual")
        is_correct = (user_guess == peer_actual)
        chemistry = 10 if is_correct else 5
        reveal_card = {
            "your_guess": user_guess,
            "actual": peer_actual,
            "is_correct": is_correct,
            "chemistry": chemistry,
            "formatted_text": f"Your guess: {user_guess}\nActual: {peer_actual} 😳\n\n+{chemistry} Chemistry"
        }
        spark_topic = current_prompt["match_topic"] if is_correct else current_prompt["clash_topic"]

    return {
        "pair_id": pair_id,
        "prompt_idx": prompt_idx,
        "current_prompt": current_prompt,
        "has_my_submission": my_sub is not None,
        "my_actual": my_sub.get("actual") if my_sub else None,
        "my_guess": my_sub.get("guess_for_peer") if my_sub else None,
        "has_peer_submitted": peer_sub is not None,
        "both_submitted": both_submitted,
        "reveal_card": reveal_card,
        "spark_topic": spark_topic
    }

@router.post("/mini-games/game4/submit")
async def submit_game4_guess_me(req: Game4SubmitRequest):
    pair_id = ":".join(sorted([req.user_id, req.peer_id]))
    session = mini_game_sessions.setdefault(pair_id, {
        "pair_id": pair_id,
        "round_idx": 0,
        "answers": {},
        "game2": {"submissions": {}, "guesses": {}},
        "game3": {"round_idx": 0, "answers": {}},
        "game4": {"prompt_idx": 0, "submissions": {}}
    })
    g4 = session.setdefault("game4", {"prompt_idx": 0, "submissions": {}})
    g4["prompt_idx"] = req.prompt_idx
    current_prompt = MINI_GAME_GUESS_ME_PROMPTS[req.prompt_idx % len(MINI_GAME_GUESS_ME_PROMPTS)]

    g4.setdefault("submissions", {})[req.user_id] = {
        "actual": req.my_actual,
        "guess_for_peer": req.my_guess_for_peer
    }

    # If peer is a companion bot, auto-assign actual and guess
    is_bot = req.peer_id.startswith("bot_") or req.peer_id.startswith("companion_")
    if is_bot:
        g4["submissions"][req.peer_id] = {
            "actual": current_prompt["default_bot_actual"],
            "guess_for_peer": req.my_actual  # Bot guesses user's actual accurately
        }

    peer_sub = g4["submissions"].get(req.peer_id)
    both_submitted = peer_sub is not None

    user_guess = req.my_guess_for_peer
    peer_actual = peer_sub.get("actual") if peer_sub else None
    is_correct = (user_guess == peer_actual) if peer_actual else False
    chemistry = 10 if is_correct else 5

    reveal_card = {
        "your_guess": user_guess,
        "actual": peer_actual,
        "is_correct": is_correct,
        "chemistry": chemistry,
        "formatted_text": f"Your guess: {user_guess}\nActual: {peer_actual} 😳\n\n+{chemistry} Chemistry"
    }

    spark_topic = current_prompt["match_topic"] if is_correct else current_prompt["clash_topic"]

    return {
        "status": "submitted",
        "both_submitted": both_submitted,
        "reveal_card": reveal_card,
        "is_correct": is_correct,
        "chemistry_awarded": chemistry,
        "spark_topic": spark_topic
    }

