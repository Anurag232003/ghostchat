import json
import logging
import time
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
from .database import get_db

logger = logging.getLogger("e2ee.ws")

class ConnectionManager:
    def __init__(self):
        # user_id -> active WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # conversation_id -> set of user_ids currently typing
        self.typing_users: Dict[str, Set[str]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User connected: {user_id} (Active connections: {len(self.active_connections)})")

        db = get_db()
        if db is not None:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"last_seen": time.time(), "is_online": True}}
            )

        # Broadcast online status to all connected users
        await self.broadcast_presence(user_id, is_online=True)

        # Deliver pending offline encrypted messages
        await self.deliver_pending_messages(user_id)

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User disconnected: {user_id}")

        db = get_db()
        if db is not None:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"last_seen": time.time(), "is_online": False}}
            )

        # Broadcast offline status
        await self.broadcast_presence(user_id, is_online=False)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections

    async def send_to_user(self, user_id: str, message_payload: Dict[str, Any]) -> bool:
        """Sends payload to a user if connected. Returns True if delivered in real-time, False if queued."""
        if user_id in self.active_connections:
            try:
                ws = self.active_connections[user_id]
                await ws.send_text(json.dumps(message_payload))
                return True
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                self.active_connections.pop(user_id, None)
                return False
        return False

    async def broadcast_presence(self, user_id: str, is_online: bool):
        payload = {
            "type": "presence",
            "user_id": user_id,
            "is_online": is_online,
            "timestamp": time.time()
        }
        for uid, ws in list(self.active_connections.items()):
            if uid != user_id:
                try:
                    await ws.send_text(json.dumps(payload))
                except Exception:
                    pass

    async def deliver_pending_messages(self, user_id: str):
        """Flushes offline messages waiting for this user."""
        db = get_db()
        if db is None:
            return

        cursor = db.messages.find({
            "recipient_id": user_id,
            "is_delivered": False,
            "is_deleted": {"$ne": True}
        }).sort("created_at", 1)

        pending = await cursor.to_list(length=100)
        for msg in pending:
            payload = {
                "type": "encrypted_message",
                "message": {
                    "message_id": msg["message_id"],
                    "conversation_id": msg["conversation_id"],
                    "sender_id": msg["sender_id"],
                    "recipient_id": msg.get("recipient_id"),
                    "group_id": msg.get("group_id"),
                    "ciphertext": msg["ciphertext"],
                    "ratchet_header": msg.get("ratchet_header", {}),
                    "iv_or_nonce": msg.get("iv_or_nonce", ""),
                    "ephemeral_timer": msg.get("ephemeral_timer"),
                    "no_forward": msg.get("no_forward", False),
                    "reply_to_id": msg.get("reply_to_id"),
                    "created_at": msg["created_at"],
                    "status": "delivered"
                }
            }
            delivered = await self.send_to_user(user_id, payload)
            if delivered:
                await db.messages.update_one(
                    {"message_id": msg["message_id"]},
                    {"$set": {"is_delivered": True, "delivered_at": time.time()}}
                )
                # Send delivery receipt back to sender if online
                receipt_payload = {
                    "type": "signal",
                    "signal": {
                        "signal_type": "delivered",
                        "conversation_id": msg["conversation_id"],
                        "message_id": msg["message_id"],
                        "sender_id": user_id,
                        "recipient_id": msg["sender_id"],
                        "timestamp": time.time()
                    }
                }
                await self.send_to_user(msg["sender_id"], receipt_payload)

ws_manager = ConnectionManager()
