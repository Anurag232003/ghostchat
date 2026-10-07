import json
import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
try:
    from .config import HOST, PORT, CORS_ORIGINS
    from .database import init_db, get_db
    from .websocket_manager import ws_manager
    from .routes import auth, users, messages, groups, attachments, blind_date, chemistry, missions, question_cards, blind_photo, blur_reveal, safety, location, topic_rooms, self_destruct, secret_chat, personality_card, universe, instant_date, second_chance, smart_matchmaking, blind_date_xp, daily_mystery_drop, scheduled_blind_date, date_memory, architecture_blueprint
except (ImportError, ValueError):
    from config import HOST, PORT, CORS_ORIGINS
    from database import init_db, get_db
    from websocket_manager import ws_manager
    from routes import auth, users, messages, groups, attachments, blind_date, chemistry, missions, question_cards, blind_photo, blur_reveal, safety, location, topic_rooms, self_destruct, secret_chat, personality_card, universe, instant_date, second_chance, smart_matchmaking, blind_date_xp, daily_mystery_drop, scheduled_blind_date, date_memory, architecture_blueprint

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("e2ee.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing E2EE Chat server...")
    await init_db()
    yield
    logger.info("Shutting down E2EE Chat server.")

app = FastAPI(
    title="Anonymous E2EE Chat Backend",
    description="End-to-End Encrypted Anonymous Chat Server with Zero-Knowledge Blind Relays",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(messages.router)
app.include_router(groups.router)
app.include_router(attachments.router)
app.include_router(blind_date.router)
app.include_router(chemistry.router)
app.include_router(missions.router)
app.include_router(question_cards.router)
app.include_router(blind_photo.router)
app.include_router(blur_reveal.router)
app.include_router(safety.router)
app.include_router(location.router)
app.include_router(topic_rooms.router)
app.include_router(self_destruct.router)
app.include_router(secret_chat.router)
app.include_router(personality_card.router)
app.include_router(universe.router)
app.include_router(instant_date.router)
app.include_router(second_chance.router)
app.include_router(smart_matchmaking.router)
app.include_router(blind_date_xp.router)
app.include_router(daily_mystery_drop.router)
app.include_router(scheduled_blind_date.router)
app.include_router(date_memory.router)
app.include_router(architecture_blueprint.router)

@app.get("/")
@app.get("/api/health")
async def health_check():
    db = get_db()
    return {
        "status": "online",
        "service": "Anonymous E2EE Chat Relay",
        "zero_knowledge": True,
        "database": "mock_memory" if getattr(db, "name", None) is None and getattr(get_db(), "client", None) is not None else "mongodb_active",
        "timestamp": time.time()
    }

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await ws_manager.connect(user_id, websocket)
    db = get_db()

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                packet = json.loads(raw_data)
            except Exception:
                continue

            event_type = packet.get("type")
            data = packet.get("data", {})

            # 1. 1-to-1 Encrypted Message Transmission
            if event_type == "chat.send":
                message_id = data.get("message_id")
                conversation_id = data.get("conversation_id")
                recipient_id = data.get("recipient_id")
                ciphertext = data.get("ciphertext")
                ratchet_header = data.get("ratchet_header", {})
                iv_or_nonce = data.get("iv_or_nonce", "")
                ephemeral_timer = data.get("ephemeral_timer")
                no_forward = data.get("no_forward", False)
                reply_to_id = data.get("reply_to_id")
                created_at = data.get("created_at", time.time())
                is_secret_mode = bool(data.get("is_secret_mode") or data.get("secret_mode"))

                # In SECRET MODE 🔐: Forwarding is strictly prohibited
                if is_secret_mode:
                    no_forward = True

                is_recipient_online = ws_manager.is_online(recipient_id) if recipient_id else False

                # Calculate expires_at based on conversation self-destruct policy
                computed_expires_at = None
                if db is not None and conversation_id and not is_secret_mode:
                    c_policy = await db.conversation_policies.find_one({"conversation_id": conversation_id})
                    if c_policy and c_policy.get("delete_after_seconds"):
                        computed_expires_at = created_at + c_policy["delete_after_seconds"]

                msg_doc = {
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "ciphertext": ciphertext,
                    "ratchet_header": ratchet_header,
                    "iv_or_nonce": iv_or_nonce,
                    "ephemeral_timer": ephemeral_timer,
                    "expires_at": computed_expires_at,
                    "no_forward": no_forward,
                    "is_secret_mode": is_secret_mode,
                    "reply_to_id": reply_to_id,
                    "created_at": created_at,
                    "is_delivered": is_recipient_online,
                    "delivered_at": time.time() if is_recipient_online else None,
                    "is_read": False,
                    "read_at": None,
                    "is_deleted": False,
                    "reactions": {},
                    "edit_version": 0
                }

                # In SECRET MODE 🔐: NO MESSAGE HISTORY ON THE SERVER! (Bypass database insert entirely)
                if db is not None and not is_secret_mode:
                    await db.messages.insert_one(msg_doc)

                # Send ack back to sender
                await ws_manager.send_to_user(user_id, {
                    "type": "chat.sent_ack",
                    "message_id": message_id,
                    "is_delivered": is_recipient_online,
                    "is_secret_mode": is_secret_mode,
                    "timestamp": time.time()
                })

                # Blind relay to recipient if online
                if recipient_id:
                    relay_payload = {
                        "type": "encrypted_message",
                        "message": {
                            "message_id": message_id,
                            "conversation_id": conversation_id,
                            "sender_id": user_id,
                            "recipient_id": recipient_id,
                            "ciphertext": ciphertext,
                            "ratchet_header": ratchet_header,
                            "iv_or_nonce": iv_or_nonce,
                            "ephemeral_timer": ephemeral_timer,
                            "no_forward": no_forward,
                            "is_secret_mode": is_secret_mode,
                            "reply_to_id": reply_to_id,
                            "created_at": created_at,
                            "status": "delivered" if is_recipient_online else "sent"
                        }
                    }
                    delivered = await ws_manager.send_to_user(recipient_id, relay_payload)
                    if delivered and not is_recipient_online:
                        if db is not None:
                            await db.messages.update_one(
                                {"message_id": message_id},
                                {"$set": {"is_delivered": True, "delivered_at": time.time()}}
                            )

            # 2. Group Encrypted Message Transmission (Sender Key fan-out)
            elif event_type == "group.send":
                message_id = data.get("message_id")
                group_id = data.get("group_id")
                ciphertext = data.get("ciphertext")
                ratchet_header = data.get("ratchet_header", {})
                iv_or_nonce = data.get("iv_or_nonce", "")
                ephemeral_timer = data.get("ephemeral_timer")
                no_forward = data.get("no_forward", False)
                reply_to_id = data.get("reply_to_id")
                created_at = data.get("created_at", time.time())

                msg_doc = {
                    "message_id": message_id,
                    "conversation_id": group_id,
                    "group_id": group_id,
                    "sender_id": user_id,
                    "ciphertext": ciphertext,
                    "ratchet_header": ratchet_header,
                    "iv_or_nonce": iv_or_nonce,
                    "ephemeral_timer": ephemeral_timer,
                    "expires_at": None,
                    "no_forward": no_forward,
                    "reply_to_id": reply_to_id,
                    "created_at": created_at,
                    "is_deleted": False,
                    "reactions": {},
                    "edit_version": 0
                }

                if db is not None:
                    await db.messages.insert_one(msg_doc)

                # Send ack back to sender
                await ws_manager.send_to_user(user_id, {
                    "type": "chat.sent_ack",
                    "message_id": message_id,
                    "is_delivered": True,
                    "timestamp": time.time()
                })

                # Fan-out to group members
                if db is not None:
                    group = await db.groups.find_one({"group_id": group_id})
                    if group:
                        for member in group.get("members", []):
                            m_id = member.get("user_id")
                            if m_id and m_id != user_id:
                                relay_payload = {
                                    "type": "encrypted_message",
                                    "message": {
                                        "message_id": message_id,
                                        "conversation_id": group_id,
                                        "group_id": group_id,
                                        "sender_id": user_id,
                                        "ciphertext": ciphertext,
                                        "ratchet_header": ratchet_header,
                                        "iv_or_nonce": iv_or_nonce,
                                        "ephemeral_timer": ephemeral_timer,
                                        "no_forward": no_forward,
                                        "reply_to_id": reply_to_id,
                                        "created_at": created_at
                                    }
                                }
                                await ws_manager.send_to_user(m_id, relay_payload)

            # 2b. Anonymous Topic Room Encrypted Broadcast
            elif event_type == "topic_room.send":
                t_room_id = data.get("room_id")
                t_ciphertext = data.get("ciphertext")
                t_sender_pseudonym = data.get("sender_pseudonym", "👤 Anonymous")
                t_ephemeral_id = data.get("ephemeral_id", user_id)
                t_plaintext = data.get("plaintext", "")

                for uid in list(ws_manager.active_connections.keys()):
                    if uid != user_id:
                        await ws_manager.send_to_user(uid, {
                            "type": "topic_room.broadcast",
                            "room_id": t_room_id,
                            "message": {
                                "message_id": f"tmsg_{uuid.uuid4().hex[:10]}",
                                "room_id": t_room_id,
                                "sender_pseudonym": t_sender_pseudonym,
                                "sender_ephemeral_id": t_ephemeral_id,
                                "ciphertext": t_ciphertext,
                                "plaintext_preview": t_plaintext,
                                "created_at": time.time()
                            }
                        })

            # 3. Real-time Signals: Typing, Delivered, Read Receipts, Reactions, Edit, Delete, Disappearing Burn
            elif event_type == "chat.signal":
                sig_type = data.get("signal_type")
                conv_id = data.get("conversation_id")
                recipient_id = data.get("recipient_id")
                group_id = data.get("group_id")
                msg_id = data.get("message_id")
                extra = data.get("data", {})

                # Update DB state for receipts and edits
                if sig_type == "read" and msg_id and db is not None:
                    msg = await db.messages.find_one({"message_id": msg_id})
                    if msg:
                        update_fields = {"is_read": True, "read_at": time.time()}
                        # If disappearing message timer exists, trigger expiration countdown
                        if msg.get("ephemeral_timer"):
                            burn_time = time.time() + msg["ephemeral_timer"]
                            update_fields["expires_at"] = burn_time
                            extra["expires_at"] = burn_time
                            extra["burn_in_seconds"] = msg["ephemeral_timer"]
                        await db.messages.update_one({"message_id": msg_id}, {"$set": update_fields})

                elif sig_type == "delivered" and msg_id and db is not None:
                    await db.messages.update_one(
                        {"message_id": msg_id},
                        {"$set": {"is_delivered": True, "delivered_at": time.time()}}
                    )

                elif sig_type == "reaction" and msg_id and db is not None:
                    emoji = extra.get("emoji")
                    if emoji:
                        await db.messages.update_one(
                            {"message_id": msg_id},
                            {"$set": {f"reactions.{user_id}": emoji}}
                        )

                elif sig_type == "edit" and msg_id and db is not None:
                    new_ciphertext = extra.get("new_ciphertext")
                    if new_ciphertext:
                        await db.messages.update_one(
                            {"message_id": msg_id, "sender_id": user_id},
                            {
                                "$set": {"ciphertext": new_ciphertext, "edited_at": time.time()},
                                "$inc": {"edit_version": 1}
                            }
                        )

                elif sig_type == "delete" and msg_id and db is not None:
                    await db.messages.update_one(
                        {"message_id": msg_id, "sender_id": user_id},
                        {"$set": {"is_deleted": True, "ciphertext": "[DELETED]", "deleted_at": time.time()}}
                    )

                elif sig_type == "burn" and msg_id and db is not None:
                    await db.messages.delete_one({"message_id": msg_id})

                elif sig_type == "burn_conversation" and conv_id and db is not None:
                    await db.messages.delete_many({"conversation_id": conv_id})

                # Relay signal
                signal_payload = {
                    "type": "signal",
                    "signal": {
                        "signal_type": sig_type,
                        "conversation_id": conv_id,
                        "sender_id": user_id,
                        "recipient_id": recipient_id,
                        "group_id": group_id,
                        "message_id": msg_id,
                        "data": extra,
                        "timestamp": time.time()
                    }
                }

                if recipient_id:
                    await ws_manager.send_to_user(recipient_id, signal_payload)
                elif group_id and db is not None:
                    group = await db.groups.find_one({"group_id": group_id})
                    if group:
                        for member in group.get("members", []):
                            m_id = member.get("user_id")
                            if m_id and m_id != user_id:
                                await ws_manager.send_to_user(m_id, signal_payload)

    except WebSocketDisconnect:
        await ws_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await ws_manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
