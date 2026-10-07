import time
import random
import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..websocket_manager import ws_manager

logger = logging.getLogger("e2ee.question_cards")
router = APIRouter(prefix="/api/question-cards", tags=["Question Cards"])

# 9 Exact Categories from User Request
CATEGORIES = [
    "Deep",
    "Funny",
    "Romantic",
    "Career",
    "Childhood",
    "Future",
    "Weird",
    "Random",
    "Rapid Fire"
]

# 54+ Curated Question Cards Deck (Including Question #12 from specification)
QUESTION_CARDS: List[Dict[str, Any]] = [
    # --- DEEP ---
    {
        "id": "card_12",
        "number": 12,
        "category": "Deep",
        "question": "What's something you could talk about for hours?",
        "emoji": "🧠",
        "chat_starter": "Something I could genuinely talk about for hours without stopping is: "
    },
    {
        "id": "card_1",
        "number": 1,
        "category": "Deep",
        "question": "What is a belief or principle you hold that you will never compromise on?",
        "emoji": "🛡️",
        "chat_starter": "A non-negotiable core principle I will always protect is: "
    },
    {
        "id": "card_2",
        "number": 2,
        "category": "Deep",
        "question": "When in your life have you felt the most deeply understood by another person?",
        "emoji": "🌌",
        "chat_starter": "A moment where I felt completely and truly seen was: "
    },
    {
        "id": "card_3",
        "number": 3,
        "category": "Deep",
        "question": "What is the biggest sacrifice you've ever made for someone you care about?",
        "emoji": "🕊️",
        "chat_starter": "The hardest sacrifice I ever made for someone I loved was: "
    },
    {
        "id": "card_4",
        "number": 4,
        "category": "Deep",
        "question": "What does emotional safety mean to you in a relationship or friendship?",
        "emoji": "🗝️",
        "chat_starter": "To me, genuine emotional safety feels like: "
    },
    {
        "id": "card_5",
        "number": 5,
        "category": "Deep",
        "question": "If your life were a book, what would the current chapter be titled?",
        "emoji": "📖",
        "chat_starter": "My current life chapter would definitely be titled: "
    },

    # --- FUNNY ---
    {
        "id": "card_6",
        "number": 6,
        "category": "Funny",
        "question": "What is the absolute dumbest way you ever injured yourself?",
        "emoji": "🩹",
        "chat_starter": "The most embarrassing, ridiculous way I ever hurt myself was: "
    },
    {
        "id": "card_7",
        "number": 7,
        "category": "Funny",
        "question": "What is a completely useless talent you possess and are secretly proud of?",
        "emoji": "🎪",
        "chat_starter": "My most absurd, completely useless party trick is: "
    },
    {
        "id": "card_8",
        "number": 8,
        "category": "Funny",
        "question": "If animals could talk, which species would be the rudest and why?",
        "emoji": "🦙",
        "chat_starter": "Without a doubt, the rudest talking animal on Earth would be: "
    },
    {
        "id": "card_9",
        "number": 9,
        "category": "Funny",
        "question": "What is the most awkward lie you told to escape a social situation?",
        "emoji": "🏃",
        "chat_starter": "The most unhinged excuse I ever made up to leave an event was: "
    },
    {
        "id": "card_10",
        "number": 10,
        "category": "Funny",
        "question": "What movie plot sounds completely unhinged when explained poorly?",
        "emoji": "🍿",
        "chat_starter": "Guess this movie described horribly: "
    },
    {
        "id": "card_11",
        "number": 11,
        "category": "Funny",
        "question": "If you were arrested with zero explanation, what would your friends assume you did?",
        "emoji": "🚔",
        "chat_starter": "If I got locked up, my friends would instantly assume I: "
    },

    # --- ROMANTIC ---
    {
        "id": "card_13",
        "number": 13,
        "category": "Romantic",
        "question": "What is a subtle gesture or small moment that makes your heart skip a beat?",
        "emoji": "💓",
        "chat_starter": "The tiniest romantic gesture that always gives me butterflies is: "
    },
    {
        "id": "card_14",
        "number": 14,
        "category": "Romantic",
        "question": "Do you believe in love at first conversation, or does it require slow burning?",
        "emoji": "🔥",
        "chat_starter": "My philosophy on romantic connection: instant spark vs slow burn? Here's what I think: "
    },
    {
        "id": "card_15",
        "number": 15,
        "category": "Romantic",
        "question": "What is your idea of an effortlessly magical first date?",
        "emoji": "✨",
        "chat_starter": "My ideal, effortless dream date would look like: "
    },
    {
        "id": "card_16",
        "number": 16,
        "category": "Romantic",
        "question": "What song instantly makes you feel romantic or nostalgic?",
        "emoji": "🎶",
        "chat_starter": "The song that instantly puts me in a romantic reverie is: "
    },
    {
        "id": "card_17",
        "number": 17,
        "category": "Romantic",
        "question": "How do you prefer to receive affection: words, quality time, or thoughtful actions?",
        "emoji": "💌",
        "chat_starter": "The love language that resonates deepest with my soul is: "
    },
    {
        "id": "card_18",
        "number": 18,
        "category": "Romantic",
        "question": "What was the most romantic scene in cinema history to you?",
        "emoji": "🎬",
        "chat_starter": "The cinema scene that set an impossibly high romantic bar was: "
    },

    # --- CAREER ---
    {
        "id": "card_19",
        "number": 19,
        "category": "Career",
        "question": "What was the worst job or task you ever worked, and what did it teach you?",
        "emoji": "💼",
        "chat_starter": "My absolute worst job experience ever was: "
    },
    {
        "id": "card_20",
        "number": 20,
        "category": "Career",
        "question": "If you could shadow any professional in the world for one week, who would it be?",
        "emoji": "🕵️",
        "chat_starter": "If I could shadow anyone at work for a week, I'd shadow: "
    },
    {
        "id": "card_21",
        "number": 21,
        "category": "Career",
        "question": "What project or achievement in your career are you most quietly proud of?",
        "emoji": "🏆",
        "chat_starter": "The accomplishment I'm most quietly proud of achieving is: "
    },
    {
        "id": "card_22",
        "number": 22,
        "category": "Career",
        "question": "Do you work to live, or live to work?",
        "emoji": "⚖️",
        "chat_starter": "My honest take on career vs life balance: "
    },
    {
        "id": "card_23",
        "number": 23,
        "category": "Career",
        "question": "What is a career risk you took that either paid off or taught you a major lesson?",
        "emoji": "🎲",
        "chat_starter": "The biggest professional leap of faith I took was: "
    },
    {
        "id": "card_24",
        "number": 24,
        "category": "Career",
        "question": "What is an unconventional industry or side hustle you find fascinating?",
        "emoji": "💡",
        "chat_starter": "A wild industry or weird niche side hustle I find super cool is: "
    },

    # --- CHILDHOOD ---
    {
        "id": "card_25",
        "number": 25,
        "category": "Childhood",
        "question": "What was your favourite cartoon, anime, or Saturday morning TV show growing up?",
        "emoji": "📺",
        "chat_starter": "My sacred Saturday morning childhood obsession was: "
    },
    {
        "id": "card_26",
        "number": 26,
        "category": "Childhood",
        "question": "What imaginary game or secret world did you invent as a child?",
        "emoji": "🧸",
        "chat_starter": "The secret imaginary world I used to pretend lived in my backyard was: "
    },
    {
        "id": "card_27",
        "number": 27,
        "category": "Childhood",
        "question": "What childhood snack or candy instantly brings you back to elementary school?",
        "emoji": "🍭",
        "chat_starter": "The nostalgic snack that instantly teleports me back to childhood is: "
    },
    {
        "id": "card_28",
        "number": 28,
        "category": "Childhood",
        "question": "Who was your childhood hero or fictional character you wanted to be?",
        "emoji": "🦸",
        "chat_starter": "Growing up, the fictional hero I desperately wanted to be was: "
    },
    {
        "id": "card_29",
        "number": 29,
        "category": "Childhood",
        "question": "What was a rule your parents had that you thought was unfair at the time?",
        "emoji": "⏳",
        "chat_starter": "The household rule I used to resent as a kid was: "
    },
    {
        "id": "card_30",
        "number": 30,
        "category": "Childhood",
        "question": "What toy or possession was your prized treasure when you were 8 years old?",
        "emoji": "🎮",
        "chat_starter": "My most sacred, irreplaceable possession as a kid was: "
    },

    # --- FUTURE ---
    {
        "id": "card_31",
        "number": 31,
        "category": "Future",
        "question": "Where in the world do you see yourself living 10 years from now?",
        "emoji": "🗺️",
        "chat_starter": "Ten years from now, I envision my sanctuary and home being located in: "
    },
    {
        "id": "card_32",
        "number": 32,
        "category": "Future",
        "question": "What is one futuristic technology you desperately hope gets invented in your lifetime?",
        "emoji": "🚀",
        "chat_starter": "The sci-fi invention I genuinely pray gets built in our lifetime is: "
    },
    {
        "id": "card_33",
        "number": 33,
        "category": "Future",
        "question": "What bucket list adventure are you determined to conquer before you turn 50?",
        "emoji": "⛰️",
        "chat_starter": "The #1 non-negotiable adventure on my bucket list is: "
    },
    {
        "id": "card_34",
        "number": 34,
        "category": "Future",
        "question": "What kind of legacy or impact do you want to leave behind on people who know you?",
        "emoji": "🌱",
        "chat_starter": "When people remember my presence in their lives, I hope they remember: "
    },
    {
        "id": "card_35",
        "number": 35,
        "category": "Future",
        "question": "If you could know the exact answer to one question about your future, what would you ask?",
        "emoji": "🔮",
        "chat_starter": "The single burning question I would ask an oracle about my future: "
    },
    {
        "id": "card_36",
        "number": 36,
        "category": "Future",
        "question": "What is a personal habit or skill you are actively trying to develop for your future self?",
        "emoji": "📈",
        "chat_starter": "The discipline or craft I'm actively cultivating right now is: "
    },

    # --- WEIRD ---
    {
        "id": "card_37",
        "number": 37,
        "category": "Weird",
        "question": "What food combination do you love that disgusts everyone else?",
        "emoji": "🍕",
        "chat_starter": "Don't judge me, but my weirdest delicious food combination is: "
    },
    {
        "id": "card_38",
        "number": 38,
        "category": "Weird",
        "question": "What conspiracy theory, no matter how wild, do you secretly find entertaining or plausible?",
        "emoji": "🛸",
        "chat_starter": "The unhinged theory that I secretly find fascinating is: "
    },
    {
        "id": "card_39",
        "number": 39,
        "category": "Weird",
        "question": "If you had to be haunted by a ghost, what mildly annoying habit would you want it to have?",
        "emoji": "👻",
        "chat_starter": "My personal ghost would probably mildly annoy me by: "
    },
    {
        "id": "card_40",
        "number": 40,
        "category": "Weird",
        "question": "What is the strangest coincidence that has ever happened to you?",
        "emoji": "🌀",
        "chat_starter": "The glitch-in-the-matrix coincidence that blew my mind was: "
    },
    {
        "id": "card_41",
        "number": 41,
        "category": "Weird",
        "question": "If aliens visited Earth tomorrow and chose you as ambassador, what is the first thing you show them?",
        "emoji": "👽",
        "chat_starter": "To explain humanity to visiting extraterrestrials, the first thing I show them is: "
    },
    {
        "id": "card_42",
        "number": 42,
        "category": "Weird",
        "question": "What object in your room right now would baffle archaeologists 3,000 years in the future?",
        "emoji": "🏺",
        "chat_starter": "Future archaeologists digging up my room would be utterly perplexed by: "
    },

    # --- RANDOM ---
    {
        "id": "card_43",
        "number": 43,
        "category": "Random",
        "question": "If you could instantly speak with all marine creatures, what's the first question you ask an octopus?",
        "emoji": "🐙",
        "chat_starter": "Octopus interrogation: The first question I'm asking this eight-legged genius is: "
    },
    {
        "id": "card_44",
        "number": 44,
        "category": "Random",
        "question": "What is the best scent in the entire world (petrichor, fresh bakery, old books)?",
        "emoji": "☕",
        "chat_starter": "The undisputed, greatest scent in the physical universe is: "
    },
    {
        "id": "card_45",
        "number": 45,
        "category": "Random",
        "question": "If you were forced to eat only one cuisine for the rest of your life, what are you picking?",
        "emoji": "🍱",
        "chat_starter": "If I could only eat one cuisine forever, without hesitation I pick: "
    },
    {
        "id": "card_46",
        "number": 46,
        "category": "Random",
        "question": "Window seat or aisle seat, and why?",
        "emoji": "✈️",
        "chat_starter": "Airplane battle lines: Window or Aisle? Here is my passionate stance: "
    },
    {
        "id": "card_47",
        "number": 47,
        "category": "Random",
        "question": "What board game or video game ruins friendships the fastest in your experience?",
        "emoji": "🎲",
        "chat_starter": "The game that has shattered the most friendships in human history is: "
    },
    {
        "id": "card_48",
        "number": 48,
        "category": "Random",
        "question": "If you were a mythical creature, would you be a dragon, phoenix, griffin, or kraken?",
        "emoji": "🐉",
        "chat_starter": "My mythical spirit creature is definitely: "
    },

    # --- RAPID FIRE ---
    {
        "id": "card_49",
        "number": 49,
        "category": "Rapid Fire",
        "question": "Night owl 🌙 or Early bird 🌅?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Night owl 🌙 or Early bird 🌅? My answer: "
    },
    {
        "id": "card_50",
        "number": 50,
        "category": "Rapid Fire",
        "question": "Mountains 🏔️ or Beaches 🏖️?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Mountains 🏔️ or Beaches 🏖️? My answer: "
    },
    {
        "id": "card_51",
        "number": 51,
        "category": "Rapid Fire",
        "question": "Texting 💬 or Voice calling 📞?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Texting 💬 or Voice calling 📞? My answer: "
    },
    {
        "id": "card_52",
        "number": 52,
        "category": "Rapid Fire",
        "question": "Sweet 🍫 or Savoury 🧀?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Sweet 🍫 or Savoury 🧀? My answer: "
    },
    {
        "id": "card_53",
        "number": 53,
        "category": "Rapid Fire",
        "question": "Spontaneous road trip 🚗 or Meticulously planned itinerary 📋?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Spontaneous road trip 🚗 or Planned itinerary 📋? My answer: "
    },
    {
        "id": "card_54",
        "number": 54,
        "category": "Rapid Fire",
        "question": "Cats 🐱 or Dogs 🐶 or Capybaras 🐾?",
        "emoji": "⚡",
        "chat_starter": "Rapid Fire: Cats 🐱, Dogs 🐶, or Capybaras 🐾? My answer: "
    }
]

# Session answers store: session_id -> { card_id: { user_id: answer_text } }
card_session_answers: Dict[str, dict] = {}

class CardAnswerRequest(BaseModel):
    session_id: str
    user_id: str
    card_id: str
    answer: str

@router.get("/categories")
async def get_categories():
    """
    Returns list of 9 question card categories with card counts.
    """
    counts = {}
    for c in QUESTION_CARDS:
        cat = c["category"]
        counts[cat] = counts.get(cat, 0) + 1
    return {
        "categories": CATEGORIES,
        "counts": counts,
        "total_cards": len(QUESTION_CARDS)
    }

@router.get("/catalog")
async def get_cards_catalog(category: Optional[str] = None):
    """
    Returns all cards in deck, optionally filtered by category.
    """
    cards = QUESTION_CARDS
    if category and category.lower() != "all":
        cards = [c for c in QUESTION_CARDS if c["category"].lower() == category.lower()]
    return {
        "total_cards": len(cards),
        "category_filter": category or "All",
        "cards": cards
    }

@router.get("/random")
async def get_random_card(category: Optional[str] = None):
    """
    Pulls a random card from the deck, optionally within a specified category.
    """
    deck = QUESTION_CARDS
    if category and category.lower() != "all":
        deck = [c for c in QUESTION_CARDS if c["category"].lower() == category.lower()]
    if not deck:
        raise HTTPException(status_code=404, detail="No cards found for category")
    return random.choice(deck)

@router.post("/answer")
async def submit_card_answer(req: CardAnswerRequest):
    """
    Records an answer to a question card and broadcasts via WebSocket.
    """
    card_map = {c["id"]: c for c in QUESTION_CARDS}
    card = card_map.get(req.card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")

    sess = card_session_answers.setdefault(req.session_id, {})
    card_answers = sess.setdefault(req.card_id, {})
    card_answers[req.user_id] = {
        "answer": req.answer,
        "timestamp": time.time()
    }

    # Broadcast via WebSocket if 1-on-1 session
    if ":" in req.session_id:
        users = req.session_id.split(":")
        for u in users:
            await ws_manager.send_to_user(u, {
                "type": "signal",
                "signal": {
                    "signal_type": "question_card.answered",
                    "session_id": req.session_id,
                    "answered_by": req.user_id,
                    "card": card,
                    "answer": req.answer,
                    "timestamp": time.time()
                }
            })

    return {
        "status": "answered",
        "card": card,
        "answer": req.answer,
        "total_answers_for_card": len(card_answers)
    }
