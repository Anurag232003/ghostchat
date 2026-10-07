from typing import Dict, Any, List
from fastapi import APIRouter

router = APIRouter(prefix="/api/architecture", tags=["architecture-blueprint"])

RECOMMENDED_ARCHITECTURE_TREE = """
                FRONTEND
                    │
          React / React Native
                    │
              WebSocket
                    │
              Node.js API / FastAPI
                    │
       ┌────────────┴────────────┐
       │                         │
   Socket Server             REST API
       │                         │
       └────────────┬────────────┘
                    │
                 Redis
                    │
          Real-Time Presence
          Match Queue
          Blind Date Queue
                    │
                Database
          PostgreSQL / MongoDB
"""

ENCRYPTION_LAYER_FLOW = """
Client A
   ↓
Generate/obtain keys
   ↓
Encrypt message locally
   ↓
WebSocket
   ↓
Server (Blind Relay)
   ↓
WebSocket
   ↓
Client B
   ↓
Decrypt locally
"""

COMPLETE_USER_FLOW = """
OPEN APP
   ↓
Create Anonymous Identity
   ↓
Choose Interests
   ↓
Choose Blind Date
   ↓
Select Mode
   ↓
┌──────────────────────┐
│ 5-Min Quick Date     │
│ 15-Min Mystery Date  │
│ Voice Date           │
│ Game Date            │
└──────────────────────┘
   ↓
Enter Match Queue
   ↓
Anonymous Match Found
   ↓
"Your Mystery Match has arrived"
   ↓
Question #1
   ↓
Encrypted Chat
   ↓
Mini Games
   ↓
Conversation Missions
   ↓
Chemistry/interaction progress
   ↓
Optional Identity Reveal
   ↓
DATE ENDS
   ↓
┌───────────────────────┐
│ ❤️ Continue           │
│ 🤝 Friends            │
│ 🔄 Maybe Later         │
│ 👋 Leave               │
└───────────────────────┘
"""

DATABASE_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "Users": {
        "description": "Anonymous pseudonymous user directory with X3DH/Ed25519 identity keys",
        "fields": ["id", "username", "public_key", "avatar", "age_range", "interests", "created_at"]
    },
    "Conversations": {
        "description": "Conversation sessions across direct, blind date, secret, and group formats",
        "fields": ["id", "type", "created_at", "expires_at"]
    },
    "Messages": {
        "description": "End-to-end encrypted message packets with forward secrecy ratchets",
        "fields": ["id", "conversation_id", "sender_id", "encrypted_payload", "nonce", "timestamp", "expires_at"]
    },
    "BlindDates": {
        "description": "Ephemeral blind date encounters with timer enforcement and progressive reveal states",
        "fields": ["id", "user_a", "user_b", "status", "mode", "started_at", "expires_at", "reveal_level"]
    },
    "BlindDateAnswers": {
        "description": "Encrypted prompt responses exchanged inside the blind date chamber",
        "fields": ["date_id", "question_id", "encrypted_answer"]
    },
    "MatchQueue": {
        "description": "Real-time discovery queue matching available anonymous users by mode and interests",
        "fields": ["user_id", "preferences", "interests", "availability", "mode", "joined_at"]
    }
}

@router.get("/blueprint")
def get_architecture_blueprint() -> Dict[str, Any]:
    """
    Returns the comprehensive Recommended Technical Architecture,
    Encryption Layer specifications, Database Schema models, and Complete User Flow.
    """
    return {
        "status": "success",
        "title": "🏗️ Recommended Technical Architecture",
        "architecture_tree": RECOMMENDED_ARCHITECTURE_TREE.strip(),
        "encryption_layer": {
            "flow": ENCRYPTION_LAYER_FLOW.strip(),
            "server_responsibilities": [
                "Encrypted payload",
                "User/session metadata",
                "Delivery status",
                "Routing"
            ],
            "server_forbidden": "Plaintext message content (Zero-knowledge guarantee)"
        },
        "database_structure": DATABASE_SCHEMAS,
        "complete_user_flow": {
            "diagram": COMPLETE_USER_FLOW.strip(),
            "available_modes": [
                "5-Min Quick Date",
                "15-Min Mystery Date",
                "Voice Date",
                "Game Date"
            ],
            "date_end_actions": [
                "❤️ Continue",
                "🤝 Friends",
                "🔄 Maybe Later",
                "👋 Leave"
            ]
        }
    }

@router.get("/schema-models")
def get_database_schema_models() -> Dict[str, Any]:
    """
    Returns the database structure mapping for college/project implementation.
    """
    return {
        "status": "success",
        "tables": DATABASE_SCHEMAS
    }
