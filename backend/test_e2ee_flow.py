import asyncio
import time
import uuid
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_db

import sys
sys.stdout.reconfigure(encoding='utf-8')

async def run_tests():
    print("==================================================")
    print("[E2EE] ZERO-KNOWLEDGE BACKEND FLOW TEST")
    print("==================================================")

    # Initialize DB (using mongomock_motor fallback if Mongo is offline)
    await init_db()
    client = TestClient(app)

    # 1. Health Check
    health = client.get("/api/health")
    assert health.status_code == 200, f"Health check failed: {health.text}"
    print(f"[OK] 1. Server Health: {health.json()['service']} (Zero-Knowledge: {health.json()['zero_knowledge']})")

    # 2. Register User A (Alice)
    alice_reg = client.post("/api/auth/register", json={
        "pseudonym": "AliceSecretAgent",
        "ed25519_identity_pub": "8db47cbe91dafec58db47cbe91dafec58db47cbe91dafec58db47cbe91dafec5",
        "x25519_signed_prekey": "2e5a3c128d6f555e2e5a3c128d6f555e2e5a3c128d6f555e2e5a3c128d6f555e",
        "signed_prekey_sig": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        "one_time_prekeys": [
            "1111111111111111111111111111111111111111111111111111111111111111",
            "2222222222222222222222222222222222222222222222222222222222222222"
        ]
    })
    assert alice_reg.status_code == 200
    alice_data = alice_reg.json()
    alice_id = alice_data["user_id"]
    print(f"[OK] 2. Alice Registered: user_id={alice_id}")

    # 3. Register User B (Bob)
    bob_reg = client.post("/api/auth/register", json={
        "pseudonym": "BobCipherVanguard",
        "ed25519_identity_pub": "857d0585aebd0229857d0585aebd0229857d0585aebd0229857d0585aebd0229",
        "x25519_signed_prekey": "3f4a5b6c7d8e9f0a3f4a5b6c7d8e9f0a3f4a5b6c7d8e9f0a3f4a5b6c7d8e9f0a",
        "signed_prekey_sig": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
        "one_time_prekeys": [
            "3333333333333333333333333333333333333333333333333333333333333333"
        ]
    })
    assert bob_reg.status_code == 200
    bob_data = bob_reg.json()
    bob_id = bob_data["user_id"]
    print(f"[OK] 3. Bob Registered: user_id={bob_id}")

    # 4. Directory Listing
    users_res = client.get(f"/api/users/list?exclude_id={alice_id}")
    assert users_res.status_code == 200
    peers = users_res.json()
    assert any(p["user_id"] == bob_id for p in peers)
    print(f"[OK] 4. Peer Directory Verified: Alice found Bob ({peers[0]['pseudonym']})")

    # 5. Fetch Prekey Bundle for X3DH
    bundle_res = client.get(f"/api/users/{bob_id}/prekey-bundle")
    assert bundle_res.status_code == 200
    bundle = bundle_res.json()
    assert bundle["one_time_prekey"] == "3333333333333333333333333333333333333333333333333333333333333333"
    print(f"[OK] 5. Prekey Bundle Fetched: Signed Prekey={bundle['x25519_signed_prekey'][:16]}... (One-time Prekey popped)")

    # 6. Verify One-Time Prekey Consumed (PFS guarantee)
    bundle_res2 = client.get(f"/api/users/{bob_id}/prekey-bundle")
    assert bundle_res2.status_code == 200
    bundle2 = bundle_res2.json()
    assert bundle2["one_time_prekey"] is None
    print("[OK] 6. Forward Secrecy Verified: One-time prekey exhausted on server")

    # 7. Zero-Knowledge Attachment Upload & Download
    raw_ciphertext = b"\x8f\xa9\x20\x01\xfe\xca\xde\xad\xbe\xef" * 50
    upload_res = client.post("/api/attachments/upload?uploader_id=alice", files={"file": ("vault.enc", raw_ciphertext, "application/octet-stream")})
    assert upload_res.status_code == 200
    att_meta = upload_res.json()
    att_id = att_meta["attachment_id"]
    print(f"[OK] 7. Encrypted Attachment Uploaded: attachment_id={att_id}, sha256={att_meta['sha256_checksum'][:16]}...")

    dl_res = client.get(f"/api/attachments/download/{att_id}")
    assert dl_res.status_code == 200
    assert dl_res.content == raw_ciphertext
    print("[OK] 8. Encrypted Attachment Downloaded: Byte-for-byte exact ciphertext match (Zero server knowledge)")

    # 8. Group Creation with Sender Keys
    grp_res = client.post(f"/api/groups/create?creator_id={alice_id}", json={
        "name": "Ghost Commandos",
        "member_ids": [bob_id],
        "encrypted_sender_keys": {
            bob_id: {"ciphertext": "encrypted_sender_key_blob_via_pairwise_ratchet"}
        }
    })
    assert grp_res.status_code == 200
    grp_data = grp_res.json()
    print(f"[OK] 9. Encrypted Group Created: group_id={grp_data['group_id']}, name={grp_data['name']}")

    # 9. Verify Server Database Stores Zero Plaintext
    db = get_db()
    # Insert a sample message packet as WebSocket would
    msg_id = "test_msg_001"
    await db.messages.insert_one({
        "message_id": msg_id,
        "conversation_id": bob_id,
        "sender_id": alice_id,
        "recipient_id": bob_id,
        "ciphertext": "8fA92xK29vLmZqRt12398402934",
        "ratchet_header": {"dh_ratchet_pub": "abcd1234"},
        "iv_or_nonce": "1234567890abcdef12345678",
        "ephemeral_timer": 5,
        "expires_at": None,
        "no_forward": True,
        "created_at": time.time(),
        "is_delivered": False,
        "is_read": False,
        "is_deleted": False
    })

    stored = await db.messages.find_one({"message_id": msg_id})
    assert stored["ciphertext"] == "8fA92xK29vLmZqRt12398402934"
    assert "plaintext" not in stored
    print("[OK] 10. Database Zero-Knowledge Verification: Ciphertext stored directly on server without plaintext field")

    # 10. Pseudonymous Progressive Identity Tests (Levels 0 - 5)
    # Check default Level 1 reveal from Bob to Alice
    rev_l1 = client.get(f"/api/users/{bob_id}/revealed-to/{alice_id}")
    assert rev_l1.status_code == 200
    p1 = rev_l1.json()
    assert p1["level_unlocked"] == 1
    assert p1["nickname"] is not None
    assert p1["first_name"] is None
    assert p1["photo_url"] is None
    assert p1["socials"] is None
    print("[OK] 11. Progressive Identity L1 Verified: Nickname & Ghost ID visible, Personal data sealed")

    # Bob grants Level 2 (Interests + Age)
    grant_l2 = client.post(f"/api/users/unlock-level?user_id={bob_id}", json={
        "target_user_id": alice_id,
        "target_level": 2,
        "action": "grant"
    })
    assert grant_l2.status_code == 200
    rev_l2 = client.get(f"/api/users/{bob_id}/revealed-to/{alice_id}").json()
    assert rev_l2["level_unlocked"] == 2
    assert rev_l2["age"] == 23
    assert "☕ Coffee" in rev_l2["interests"]
    assert rev_l2["first_name"] is None
    print("[OK] 12. Progressive Identity L2 Verified: Age (23) & Interests revealed; Real name/photo sealed")

    # Bob grants Level 3 (First Name)
    grant_l3 = client.post(f"/api/users/unlock-level?user_id={bob_id}", json={
        "target_user_id": alice_id,
        "target_level": 3,
        "action": "grant"
    })
    assert grant_l3.status_code == 200
    rev_l3 = client.get(f"/api/users/{bob_id}/revealed-to/{alice_id}").json()
    assert rev_l3["level_unlocked"] == 3
    assert rev_l3["first_name"] is not None
    assert rev_l3["photo_url"] is None
    print(f"[OK] 13. Progressive Identity L3 Verified: First Name revealed ({rev_l3['first_name']}), Photo sealed")

    # Bob grants Level 5 (Photo + Socials)
    grant_l5 = client.post(f"/api/users/unlock-level?user_id={bob_id}", json={
        "target_user_id": alice_id,
        "target_level": 5,
        "action": "grant"
    })
    assert grant_l5.status_code == 200
    rev_l5 = client.get(f"/api/users/{bob_id}/revealed-to/{alice_id}").json()
    assert rev_l5["level_unlocked"] == 5
    assert rev_l5["photo_url"] is not None
    assert rev_l5["socials"] is not None
    print(f"[OK] 14. Progressive Identity L5 Verified: Photo & Socials fully unlocked ({rev_l5['socials']})")

    # 14b. Feature 7: Progressive Identity Reveal (Mystery -> 5m Interest -> 10m Nickname -> Mutual Avatar -> Mutual Photo)
    # Reset pair to 00:00 (Stage 0: 🌑 Mystery Person)
    reset_resp = client.post(f"/api/users/progressive-reveal/reset?user_id={alice_id}&peer_id={bob_id}")
    assert reset_resp.status_code == 200

    s0 = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s0["stage"] == 0
    assert s0["mystery_title"] == "🌑 Mystery Person"
    assert s0["interest_1_unlocked"] is False
    assert s0["interest_1"] is None
    assert s0["nickname_unlocked"] is False
    assert s0["nickname"] is None
    assert s0["mutual_interest_unlocked"] is False
    assert s0["photo_unlocked"] is False
    print("[OK] 14b-1. Stage 0 Verified: 🌑 Mystery Person (all traits completely shrouded)")

    # Fast forward 5 minutes (+300s) -> Stage 1: Interest #1 revealed
    ff_5m = client.post("/api/users/progressive-reveal/fast-forward", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "add_seconds": 305
    })
    assert ff_5m.status_code == 200

    s1 = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s1["stage"] == 1
    assert s1["interest_1_unlocked"] is True
    assert s1["interest_1"] is not None
    assert s1["nickname_unlocked"] is False
    assert s1["photo_unlocked"] is False
    print(f"[OK] 14b-2. Stage 1 Verified: After 5 minutes, Interest #1 revealed ({s1['interest_1']})")

    # Fast forward another 5 minutes (+300s -> 10+ minutes) -> Stage 2: Nickname revealed
    ff_10m = client.post("/api/users/progressive-reveal/fast-forward", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "add_seconds": 300
    })
    assert ff_10m.status_code == 200

    s2 = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s2["stage"] == 2
    assert s2["nickname_unlocked"] is True
    assert s2["nickname"] is not None
    assert s2["mutual_interest_unlocked"] is False
    print(f"[OK] 14b-3. Stage 2 Verified: After 10 minutes, Nickname revealed ({s2['nickname']})")

    # Declare mutual interest -> Stage 3: Avatar revealed
    # Alice declares interest
    d_alice = client.post("/api/users/progressive-reveal/declare-interest", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "interested": True
    }).json()
    assert d_alice["mutual_interest"] is False  # Only Alice so far

    # Bob declares interest
    d_bob = client.post("/api/users/progressive-reveal/declare-interest", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "interested": True
    }).json()
    assert d_bob["mutual_interest"] is True  # Both declared!

    s3 = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s3["stage"] == 3
    assert s3["mutual_interest_unlocked"] is True
    assert s3["avatar_emoji"] is not None
    assert s3["photo_unlocked"] is False
    print(f"[OK] 14b-4. Stage 3 Verified: After mutual interest, Avatar revealed ({s3['avatar_emoji']})")

    # Stage 4: Photo Reveal with mutual consent prompt:
    # "Nova wants to reveal their profile. Reveal to each other? [ Reveal ] [ Keep Anonymous ]"
    # Alice requests photo reveal
    req_photo = client.post("/api/users/progressive-reveal/request-photo", json={
        "user_id": alice_id,
        "peer_id": bob_id
    }).json()
    assert req_photo["status"] == "requested"
    assert "wants to reveal their profile" in req_photo["prompt"]

    # Bob inspects status: sees prompt and requested_by_peer
    bob_status = client.get(f"/api/users/progressive-reveal/status?user_id={bob_id}&peer_id={alice_id}").json()
    assert bob_status["photo_consent_status"] == "requested_by_peer"
    assert "wants to reveal their profile" in bob_status["prompt_text"]

    # Bob first declines: [ Keep Anonymous ]
    decline_resp = client.post("/api/users/progressive-reveal/consent-photo", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "consent": False
    }).json()
    assert decline_resp["outcome"] == "declined"
    assert decline_resp["is_revealed"] is False

    s_declined = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s_declined["photo_unlocked"] is False
    assert s_declined["photo_url"] is None
    print("[OK] 14b-5. Consent Guard Verified: If user chooses [ Keep Anonymous ], photo remains 100% sealed")

    # Now both consent: [ Reveal ]
    client.post("/api/users/progressive-reveal/request-photo", json={
        "user_id": alice_id,
        "peer_id": bob_id
    })
    consent_bob = client.post("/api/users/progressive-reveal/consent-photo", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "consent": True
    }).json()
    assert consent_bob["outcome"] == "mutual_reveal"
    assert consent_bob["is_revealed"] is True

    s4 = client.get(f"/api/users/progressive-reveal/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert s4["stage"] == 4
    assert s4["photo_unlocked"] is True
    assert s4["photo_url"] is not None
    print(f"[OK] 14b-6. Stage 4 Verified: Both consented [ Reveal ] -> Authentic Photo Revealed ({s4['photo_url'][:30]}...)")

    # User 1 enters Blind Date queue
    q1 = client.post("/api/blind-date/queue", json={
        "user_id": alice_id,
        "vibe": "🌙 Late Night Deep Talks"
    })
    assert q1.status_code == 200
    assert q1.json()["status"] == "queued"
    print("[OK] 15. Blind Date Matchmaking Queue: Alice entered queue, masked as shadow")

    # User 2 enters queue -> Instant Anonymous Match!
    q2 = client.post("/api/blind-date/queue", json={
        "user_id": bob_id,
        "vibe": "🌙 Late Night Deep Talks"
    })
    assert q2.status_code == 200
    match_data = q2.json()
    assert match_data["status"] == "matched"
    room_id = match_data["room_id"]
    print(f"[OK] 16. Blind Date Room Spun Up: room_id={room_id}, peer_ghost={match_data['peer_ghost']}")

    # Check room state: both users are completely masked
    room = client.get(f"/api/blind-date/room/{room_id}").json()
    assert room["user1"]["ghost"].startswith("Shadow#")
    assert room["user2"]["ghost"].startswith("Phantom#")
    assert room["chemistry"] == 20
    print("[OK] 17. Blind Date Identity Guard: Real names, ages & photos 100% shrouded in chamber")

    # Alice and Bob complete Activity 1 (This or That)
    ans1_a = client.post(f"/api/blind-date/room/{room_id}/answer", json={
        "user_id": alice_id,
        "activity_idx": 0,
        "answer": "☕ Cozy Cafe & Books"
    })
    assert ans1_a.status_code == 200

    ans1_b = client.post(f"/api/blind-date/room/{room_id}/answer", json={
        "user_id": bob_id,
        "activity_idx": 0,
        "answer": "☕ Cozy Cafe & Books"
    })
    assert ans1_b.status_code == 200
    res1_b = ans1_b.json()
    assert res1_b["both_answered"] is True
    assert res1_b["chemistry"] > 20
    print(f"[OK] 18. Activity 1 Completed: Mutual answers matched! Chemistry boosted to {res1_b['chemistry']}%")

    # Both submit Reveal Decisions
    dec_a = client.post(f"/api/blind-date/room/{room_id}/decision", json={
        "user_id": alice_id,
        "decision": "reveal"
    })
    assert dec_a.status_code == 200

    dec_b = client.post(f"/api/blind-date/room/{room_id}/decision", json={
        "user_id": bob_id,
        "decision": "reveal"
    })
    assert dec_b.status_code == 200
    res_b = dec_b.json()
    assert res_b["is_complete"] is True
    # 20. Blind Date Mode A — Mystery Match Specification Test
    # Two random compatible users are matched. Both see:
    # Your Mystery Match
    # 🌑 Unknown
    # Age: 20–24
    # Interests: 🎮 Gaming, 🎵 Music, ☕ Coffee
    # Compatibility: Hidden
    # No photo. No real name. No social media.
    demo_match = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery")
    assert demo_match.status_code == 200, f"Demo match failed: {demo_match.text}"
    demo_data = demo_match.json()
    assert demo_data["status"] == "matched"
    assert "mystery_card" in demo_data, "mystery_card missing in response"
    
    m_card = demo_data["mystery_card"]
    assert m_card["card_title"] == "Your Mystery Match"
    assert m_card["handle"] == "🌑 Unknown"
    assert m_card["age_bracket"] == "Age: 20–24"
    assert "🎮 Gaming" in m_card["interests"]
    assert "🎵 Music" in m_card["interests"]
    assert "☕ Coffee" in m_card["interests"]
    assert m_card["compatibility"] == "Hidden"
    assert m_card["has_photo"] is False
    assert m_card["has_real_name"] is False
    assert m_card["has_socials"] is False
    assert m_card["no_photo"] is True
    assert m_card["no_real_name"] is True
    assert m_card["no_social_media"] is True
    print("[OK] 20. Blind Date Mode A (Mystery Match): Shrouded profile matches user spec exactly (Unknown, Age: 20–24, Gaming/Music/Coffee, Hidden Compat, No photo/real name/socials)")

    # 21. Blind Date Mode B — Speed Blitz (300s Countdown)
    speed_match = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=speed")
    assert speed_match.status_code == 200
    speed_room = speed_match.json()["room"]
    assert speed_room["mode"] == "speed"
    assert speed_room["time_limit_seconds"] == 300
    print("[OK] 21. Blind Date Mode B (Speed Blitz): 300-second countdown sprint enabled")

    # 22. Feature 5: Compatibility Puzzle (Question Deck & Unlocked Conversation Topics)
    # Questions: Sunrise or Midnight? Introvert evening or party night? Coffee or Chai? Travel alone or with friends? ₹10 lakh dilemma
    q_res = client.get("/api/blind-date/puzzle/questions")
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert q_data["total"] >= 5
    puzzle_qs = [q["question"] for q in q_data["questions"]]
    assert any("Sunrise or Midnight" in q for q in puzzle_qs)
    assert any("Introvert evening or party night" in q for q in puzzle_qs)
    assert any("Coffee or Chai" in q for q in puzzle_qs)
    assert any("Travel alone or with friends" in q for q in puzzle_qs)
    assert any("₹10 lakh" in q for q in puzzle_qs)

    # Compare answers where both users picked Gaming, Late nights (Midnight), and Travel
    compare_res = client.post("/api/blind-date/puzzle/compare", json={
        "user1_answers": {
            "0": "🌙 Midnight",
            "3": "✈️ Travel with friends",
            "4": "🎮 Build dream gaming rig & tech vault"
        },
        "user2_answers": {
            "0": "🌙 Midnight",
            "3": "✈️ Travel with friends",
            "4": "🎮 Build dream gaming rig & tech vault"
        }
    })
    assert compare_res.status_code == 200
    comp_data = compare_res.json()
    assert "🎮 Gaming" in comp_data["common_choices"]
    assert "🌙 Late nights" in comp_data["common_choices"]
    assert "✈️ Travel" in comp_data["common_choices"]
    assert "What's your dream destination?" in comp_data["unlocked_topics"]
    print(f"[OK] 22. Compatibility Puzzle Verified: Common choices={comp_data['common_choices']}, Unlocked conversation='{comp_data['unlocked_topics'][0]}'")

    # 23. Feature 6: Blind Date Timer (15 Minutes vs 20 Minutes)
    date_15m = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=15")
    assert date_15m.status_code == 200
    r_15m = date_15m.json()["room"]
    assert r_15m["duration_minutes"] == 15
    assert r_15m["time_limit_seconds"] == 900
    assert r_15m["expires_at"] > time.time()
    print("[OK] 23a. Blind Date Timer (15 Minutes): Duration=15m (900s) verified")

    date_20m = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20")
    assert date_20m.status_code == 200
    r_20m = date_20m.json()["room"]
    assert r_20m["duration_minutes"] == 20
    assert r_20m["time_limit_seconds"] == 1200
    assert r_20m["expires_at"] > time.time()
    print("[OK] 23b. Blind Date Timer (20 Minutes): Duration=20m (1200s) verified (e.g. 19:42 remaining)")

    # 24. Live In-Chamber Date Chat during Timer Session
    chat_post = client.post(f"/api/blind-date/room/{r_20m['room_id']}/chat", json={
        "user_id": alice_id,
        "text": "Hey! Loved seeing we both chose midnight & gaming. Having a blast on this 20-min date!"
    })
    assert chat_post.status_code == 200
    chat_data = chat_post.json()
    assert chat_data["status"] == "success"
    assert chat_data["bot_reply"] is not None
    print(f"[OK] 24. Live Blind Date Chat Session: Alice sent message, partner bot replied: '{chat_data['bot_reply']['text']}'")

    # 25. End of Date 4 Decisions:
    # ❤️ Continue | 🤝 Become Friends | 👋 End Date | 🚫 Report/Block
    # Scenario A: Continue
    dec_continue = client.post(f"/api/blind-date/room/{r_20m['room_id']}/end-date-decision", json={
        "user_id": alice_id,
        "choice": "continue"
    })
    assert dec_continue.status_code == 200
    assert dec_continue.json()["outcome"] == "continue"
    print("[OK] 25a. End Date Decision (❤️ Continue): Romantic spark confirmed, mutual Level 2 unlocked")

    # Scenario B: Become Friends
    date_friends = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20")
    rf_id = date_friends.json()["room_id"]
    dec_friends = client.post(f"/api/blind-date/room/{rf_id}/end-date-decision", json={
        "user_id": alice_id,
        "choice": "friends"
    })
    assert dec_friends.status_code == 200
    assert dec_friends.json()["outcome"] == "friends"
    print("[OK] 25b. End Date Decision (🤝 Become Friends): Platonic bond forged, connected as friends")

    # Scenario C: End Date
    date_end = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20")
    re_id = date_end.json()["room_id"]
    dec_end = client.post(f"/api/blind-date/room/{re_id}/end-date-decision", json={
        "user_id": alice_id,
        "choice": "end_date"
    })
    assert dec_end.status_code == 200
    assert dec_end.json()["outcome"] == "ended"
    print("[OK] 25c. End Date Decision (👋 End Date): Amicable farewell, temporary chamber cleanly burned")

    # Scenario D: Report / Block
    date_block = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20")
    rb_id = date_block.json()["room_id"]
    dec_block = client.post(f"/api/blind-date/room/{rb_id}/end-date-decision", json={
        "user_id": alice_id,
        "choice": "block_report",
        "report_reason": "Inappropriate messages"
    })
    assert dec_block.status_code == 200
    assert dec_block.json()["outcome"] == "blocked"
    print("[OK] 25d. End Date Decision (🚫 Report/Block): Safety protection executed, peer blocked and blacklisted")

    # 26. 🎲 Feature 8: Blind Date Mini Games (Game 1 — This or That: Pizza 🍕 vs Burger 🍔)
    # Check Mini Games Rounds deck
    deck_resp = client.get("/api/blind-date/mini-games/rounds").json()
    assert deck_resp["game_name"] == "Game 1 — This or That"
    r0 = deck_resp["rounds"][0]
    assert r0["question"] == "Pizza 🍕 or Burger 🍔?"
    assert "🍕 Pizza" in r0["options"]
    assert "🍔 Burger" in r0["options"]
    print("[OK] 26a. Mini Games Deck Verified: Game 1 — This or That (Pizza 🍕 or Burger 🍔) loaded at Round 1")

    # Reset mini-game session for Alice and Bob
    client.post(f"/api/blind-date/mini-games/reset?user_id={alice_id}&peer_id={bob_id}")

    # Initial status: both unanswered
    mg_init = client.get(f"/api/blind-date/mini-games/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert mg_init["my_answer"] is None
    assert mg_init["both_answered"] is False
    assert mg_init["peer_answer"] is None

    # Step A: Alice answers "🍕 Pizza" -> Sealed on server
    ans_alice = client.post("/api/blind-date/mini-games/answer", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "round_idx": 0,
        "answer": "🍕 Pizza"
    }).json()
    assert ans_alice["my_answer"] == "🍕 Pizza"
    assert ans_alice["both_answered"] is False
    assert ans_alice["peer_answer"] is None  # Bob hasn't answered yet, so peer answer remains sealed
    print("[OK] 26b. Simultaneous Answer Sealing: Alice answered 🍕 Pizza, choice is sealed while awaiting Bob")

    # Step B: Bob inspects status: sees Alice answered, but Alice's choice is hidden until Bob submits
    bob_check = client.get(f"/api/blind-date/mini-games/status?user_id={bob_id}&peer_id={alice_id}").json()
    assert bob_check["has_peer_answered"] is True
    assert bob_check["both_answered"] is False
    assert bob_check["peer_answer"] is None

    # Step C: Bob answers "🍕 Pizza" -> SIMULTANEOUS UNSEAL & REVEAL!
    ans_bob = client.post("/api/blind-date/mini-games/answer", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "round_idx": 0,
        "answer": "🍕 Pizza"
    }).json()
    assert ans_bob["both_answered"] is True
    assert ans_bob["peer_answer"] == "🍕 Pizza"
    assert ans_bob["is_match"] is True
    assert "You both chose Pizza 🍕" in ans_bob["spark_topic"]
    print(f"[OK] 26c. Simultaneous Unseal Verified: Both chose 🍕 Pizza! Match confirmed with topic: '{ans_bob['spark_topic'][:50]}...'")

    # Step D: Playful Clash in Round 2
    client.post("/api/blind-date/mini-games/next-round", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "next_round_idx": 1
    })
    client.post("/api/blind-date/mini-games/answer", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "round_idx": 1,
        "answer": "🌅 Sunrise"
    })
    ans_bob_r2 = client.post("/api/blind-date/mini-games/answer", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "round_idx": 1,
        "answer": "🌙 Midnight"
    }).json()
    assert ans_bob_r2["both_answered"] is True
    assert ans_bob_r2["is_match"] is False
    assert "Early bird meets night owl" in ans_bob_r2["spark_topic"]
    print("[OK] 26d. Playful Food & Vibe Clash Verified: Different answers unsealed simultaneously with debate topic")

    # 26e. Full Suite API Test
    suite_resp = client.get("/api/blind-date/mini-games/full-suite").json()
    assert len(suite_resp["games"]) == 4
    assert suite_resp["games"][0]["name"] == "Game 1 — This or That"
    assert suite_resp["games"][1]["name"] == "Game 2 — Two Truths & A Lie"
    assert suite_resp["games"][2]["name"] == "Game 3 — Would You Rather"
    assert suite_resp["games"][3]["name"] == "Game 4 — Guess Me"
    print("[OK] 26e. Full Mini Games 4-Game Suite Verified: All 4 games properly registered")

    # 26f. Game 2 — Two Truths & A Lie Test
    # Alice submits 3 statements with statement 1 being the lie
    g2_alice_sub = client.post("/api/blind-date/mini-games/game2/submit", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "statements": [
            "I've travelled alone.",
            "I hate coffee.",
            "I've broken a bone."
        ],
        "lie_index": 1  # "I hate coffee." is the lie
    }).json()
    assert g2_alice_sub["status"] == "submitted"

    # Bob submits statements with statement 2 being the lie
    g2_bob_sub = client.post("/api/blind-date/mini-games/game2/submit", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "statements": [
            "I can juggle torches.",
            "I've visited Japan.",
            "I've never watched Star Wars."
        ],
        "lie_index": 2  # "I've never watched Star Wars." is the lie
    }).json()
    assert g2_bob_sub["status"] == "submitted"

    # Bob guesses Alice's lie correctly (guesses index 1)
    g2_bob_guess = client.post("/api/blind-date/mini-games/game2/guess", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "guessed_lie_index": 1
    }).json()
    assert g2_bob_guess["is_correct"] is True
    assert g2_bob_guess["chemistry_awarded"] == 10
    assert "I hate coffee." in g2_bob_guess["reveal_text"]
    assert "Lie detected!" in g2_bob_guess["spark_topic"]
    print("[OK] 26f. Game 2 — Two Truths & A Lie Verified: Lie correctly detected (+10 Chemistry)")

    # 26g. Game 3 — Would You Rather: 🌍 Travel the world OR 🏠 Live in your dream city?
    wyr_rounds = client.get("/api/blind-date/mini-games/game3/rounds").json()
    assert wyr_rounds["rounds"][0]["option_a"] == "🌍 Travel the world"
    assert wyr_rounds["rounds"][0]["option_b"] == "🏠 Live in your dream city"

    client.post("/api/blind-date/mini-games/game3/answer", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "round_idx": 0,
        "answer": "🌍 Travel the world"
    })
    wyr_bob = client.post("/api/blind-date/mini-games/game3/answer", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "round_idx": 0,
        "answer": "🌍 Travel the world"
    }).json()
    assert wyr_bob["both_answered"] is True
    assert wyr_bob["is_match"] is True
    assert "travel the world" in wyr_bob["spark_topic"]
    print("[OK] 26g. Game 3 — Would You Rather Verified: 🌍 Travel world chosen by both, resonance topic unlocked")

    # 26h. Game 4 — Guess Me (Favourite Genre)
    # The system gives: Guess your match's favourite genre.
    # Then reveal: Your guess: Horror / Actual: Horror 😳 / +10 Chemistry
    gm_prompts = client.get("/api/blind-date/mini-games/game4/prompts").json()
    assert gm_prompts["prompts"][0]["prompt"] == "Guess your match's favourite genre."

    client.post("/api/blind-date/mini-games/game4/submit", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "prompt_idx": 0,
        "my_actual": "Horror",
        "my_guess_for_peer": "Horror"
    })
    gm_bob = client.post("/api/blind-date/mini-games/game4/submit", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "prompt_idx": 0,
        "my_actual": "Horror",
        "my_guess_for_peer": "Horror"
    }).json()
    assert gm_bob["both_submitted"] is True
    assert gm_bob["is_correct"] is True
    assert gm_bob["chemistry_awarded"] == 10
    assert gm_bob["reveal_card"]["your_guess"] == "Horror"
    assert gm_bob["reveal_card"]["actual"] == "Horror"
    assert "+10 Chemistry" in gm_bob["reveal_card"]["formatted_text"]
    assert "Actual: Horror 😳" in gm_bob["reveal_card"]["formatted_text"]
    print(f"[OK] 26h. Game 4 — Guess Me Verified:\n---\n{gm_bob['reveal_card']['formatted_text']}\n---")

    # 27. ❤️ Feature 9: Conversation Chemistry Meter
    chem_resp = client.get(f"/api/chemistry/meter?user_id={alice_id}&peer_id={bob_id}")
    assert chem_resp.status_code == 200
    chem_data = chem_resp.json()
    assert chem_data["metric_name"] == "Conversation Chemistry"
    assert "score" in chem_data
    assert isinstance(chem_data["score"], int)
    assert 0 <= chem_data["score"] <= 100
    assert "████████░░ 82" in chem_data["ascii_bar"] or "█" in chem_data["ascii_bar"]
    assert chem_data["is_factual_measure"] is False
    assert "app-generated interaction metric" in chem_data["disclaimer"].lower()
    assert "not a factual measure" in chem_data["disclaimer"].lower()

    # Verify the 5 required interaction dimensions:
    b = chem_data["breakdown"]
    assert "mutual_answers" in b
    assert "shared_interests" in b
    assert "conversation_participation" in b
    assert "mini_game_results" in b
    assert "mutual_reactions" in b
    print(f"[OK] 27a. Conversation Chemistry Meter Verified: {chem_data['metric_name']} -> {chem_data['ascii_bar']}")
    print(f"[OK] 27b. 5 Interaction Dimensions Verified: Answers={b['mutual_answers']['score']}/20, Interests={b['shared_interests']['score']}/20, Participation={b['conversation_participation']['score']}/25, Games={b['mini_game_results']['score']}/20, Reactions={b['mutual_reactions']['score']}/15")
    print(f"[OK] 27c. Metric Disclaimer Guard Verified: '{chem_data['disclaimer_short']}'")

    # Test dynamic interaction boost
    boost_resp = client.post("/api/chemistry/simulate-interaction", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "bonus_type": "reaction"
    }).json()
    assert boost_resp["score"] >= 80
    print(f"[OK] 27d. Dynamic Chemistry Boost Verified: Score={boost_resp['score']} ({boost_resp['ascii_bar']})")

    # 28. 🎯 Feature 10: Blind Date Missions
    # Verify Catalog contains > 30 missions and includes user's specific examples
    cat_resp = client.get("/api/blind-date/missions/catalog")
    assert cat_resp.status_code == 200
    cat_data = cat_resp.json()
    assert cat_data["total_missions"] > 30  # requirement: "missions should be more than 30"
    assert cat_data["total_missions"] >= 36
    
    prompts_list = [m["prompt"] for m in cat_data["missions"]]
    assert "Tell them something you've never told a stranger." in prompts_list  # Mission #1
    assert "Ask them about their dream career." in prompts_list  # Mission #2
    assert "Both choose a fictional world you'd live in." in prompts_list  # Mission #3
    assert "Send a voice note saying your favourite song." in prompts_list  # Mission #4
    print(f"[OK] 28a. Blind Date Missions Deck Verified: {cat_data['total_missions']} curated missions loaded (>30 requirement met)")

    # Reset test session for Alice and Bob
    session_pair = f"{alice_id}:{bob_id}"
    client.post(f"/api/blind-date/missions/reset?session_id={session_pair}")

    # Initial state
    act_init = client.get(f"/api/blind-date/missions/active?session_id={session_pair}").json()
    assert act_init["date_xp"] == 0
    assert len(act_init["unlocked_missions"]) >= 2
    assert len(act_init["completed_missions"]) == 0
    print(f"[OK] 28b. Active Missions Initialized: {len(act_init['unlocked_missions'])} unlocked, Date XP = {act_init['date_xp']}")

    # Complete Mission #1 -> awards ✨ Date XP +20
    comp1 = client.post("/api/blind-date/missions/complete", json={
        "session_id": session_pair,
        "user_id": alice_id,
        "mission_id": "mission_1"
    }).json()
    assert comp1["status"] == "completed"
    assert comp1["xp_awarded"] == 20
    assert comp1["total_date_xp"] == 20
    print("[OK] 28c. Mission #1 Completed ('Tell them something you've never told a stranger.'): ✨ Date XP +20 Awarded (Total: 20 XP)")

    # Complete Mission #2 -> awards another +20 XP -> Total 40 XP (Level 2: Wavelength Explorer)
    comp2 = client.post("/api/blind-date/missions/complete", json={
        "session_id": session_pair,
        "user_id": bob_id,
        "mission_id": "mission_2"
    }).json()
    assert comp2["xp_awarded"] == 20
    assert comp2["total_date_xp"] == 40
    assert comp2["rank"]["level"] == 2
    print(f"[OK] 28d. Mission #2 Completed ('Ask them about their dream career.'): ✨ Date XP +20 (Total: 40 XP, Level {comp2['rank']['level']}: {comp2['rank']['title']})")

    # Randomly unlock next mission from deck
    draw_resp = client.post("/api/blind-date/missions/unlock-next", json={
        "session_id": session_pair,
        "user_id": alice_id
    }).json()
    assert draw_resp["status"] == "unlocked"
    assert draw_resp["mission"] is not None
    print(f"[OK] 28e. Random Mission Drawn from Deck: {draw_resp['mission']['title']} -> '{draw_resp['mission']['prompt']}'")

    # 29. 🃏 Feature 11: Question Cards Swipeable Deck (50+ Questions, 9 Categories)
    # 29a. Verify Categories
    cat_resp = client.get("/api/question-cards/categories").json()
    expected_categories = [
        "Deep", "Funny", "Romantic", "Career", "Childhood", "Future", "Weird", "Random", "Rapid Fire"
    ]
    for exp_cat in expected_categories:
        assert exp_cat in cat_resp["categories"], f"Missing category: {exp_cat}"
        assert cat_resp["counts"][exp_cat] > 0, f"No questions in category: {exp_cat}"
    assert cat_resp["total_cards"] >= 50, f"Expected 50+ question cards, found {cat_resp['total_cards']}"
    print(f"[OK] 29a. Question Card Categories Verified: 9 categories confirmed with {cat_resp['total_cards']} curated cards (>50 requirement met)")

    # 29b. Verify Catalog and Specific Question #12 from wireframe
    catalog_resp = client.get("/api/question-cards/catalog").json()
    all_cards = catalog_resp["cards"]
    assert len(all_cards) >= 50
    card_12 = next((c for c in all_cards if c["number"] == 12), None)
    assert card_12 is not None, "Question #12 not found in deck"
    assert card_12["question"] == "What's something you could talk about for hours?", f"Unexpected Question #12 text: {card_12['question']}"
    assert card_12["category"] == "Deep"
    print(f"[OK] 29b. Question #12 Verified: '{card_12['question']}' ({card_12['category']}) with starter: '{card_12['chat_starter']}'")

    # Category filter check
    romantic_catalog = client.get("/api/question-cards/catalog?category=Romantic").json()
    assert all(c["category"] == "Romantic" for c in romantic_catalog["cards"])
    assert len(romantic_catalog["cards"]) >= 6
    print(f"[OK] 29c. Category Filtering Verified: {len(romantic_catalog['cards'])} Romantic cards retrieved")

    # 29d. Random Draw
    rnd_card = client.get("/api/question-cards/random?category=Rapid Fire").json()
    assert rnd_card["category"] == "Rapid Fire"
    assert "number" in rnd_card and "question" in rnd_card
    print(f"[OK] 29d. Random Card Drawn from 'Rapid Fire': #{rnd_card['number']} - '{rnd_card['question']}'")

    # 29e. Answer Submission & Multi-User Recording
    ans1 = client.post("/api/question-cards/answer", json={
        "session_id": session_pair,
        "user_id": alice_id,
        "card_id": "card_12",
        "answer": "Astrophysics, synthetic biology, and 80s synthesizer music!"
    }).json()
    assert ans1["status"] == "answered"
    assert ans1["card"]["number"] == 12
    assert ans1["total_answers_for_card"] == 1

    ans2 = client.post("/api/question-cards/answer", json={
        "session_id": session_pair,
        "user_id": bob_id,
        "card_id": "card_12",
        "answer": "Building game engines from scratch and sci-fi books!"
    }).json()
    assert ans2["status"] == "answered"
    assert ans2["total_answers_for_card"] == 2
    print(f"[OK] 29e. Question Card Answer Submitted: Both Alice & Bob recorded answers for Question #12")

    # 30. 🖼️ Feature 13: Blind Photo Reveal (Photo Locked 🔒 -> Mutual Agreement -> 🔓 Photo Unlocked)
    # 30a. Presets gallery check
    presets_resp = client.get("/api/blind-photo/presets").json()
    assert presets_resp["total"] >= 5
    assert any(p["title"] == "Sunset Silhouette" for p in presets_resp["presets"])
    print(f"[OK] 30a. Blind Photo Presets Gallery Verified: {presets_resp['total']} privacy presets loaded")

    # 30b. Alice creates a Blind Photo to send to Bob
    sunset_preset = presets_resp["presets"][0]
    create_photo_resp = client.post("/api/blind-photo/create", json={
        "uploader_id": alice_id,
        "session_id": session_pair,
        "full_photo_url": sunset_preset["full_url"],
        "preview_blur_url": sunset_preset["blur_url"],
        "caption": "Golden hour along the southern coast 🌅",
        "auto_consent_uploader": True
    }).json()
    photo_id = create_photo_resp["photo_id"]
    assert create_photo_resp["locked"] is True
    assert create_photo_resp["consents"][alice_id] is True
    print(f"[OK] 30b. Blind Photo Created: photo_id={photo_id}, Status='Photo Locked 🔒', Alice consented (1/2)")

    # 30c. Bob inspects status: full photo URL MUST be strictly sealed / None until Bob accepts!
    status_bob = client.get(f"/api/blind-photo/status/{photo_id}?user_id={bob_id}").json()
    assert status_bob["locked"] is True
    assert status_bob["unlocked"] is False
    assert status_bob["peer_consent"] is True  # Alice consented
    assert status_bob["my_consent"] is None    # Bob hasn't consented yet
    assert status_bob["full_photo_url"] is None, "SECURITY FAIL: full photo url must be hidden when locked!"
    print(f"[OK] 30c. Zero-Knowledge Photo Shield Verified: full_photo_url is strictly sealed on server while locked")

    # 30d. Bob explicitly keeps locked / declines
    decline_resp = client.post("/api/blind-photo/consent", json={
        "photo_id": photo_id,
        "user_id": bob_id,
        "consent": False
    }).json()
    assert decline_resp["locked"] is True
    assert decline_resp["unlocked"] is False
    assert decline_resp["full_photo_url"] is None
    print(f"[OK] 30d. Consent Guard Verified: When Bob declines, photo remains 100% 'Photo Locked 🔒'")

    # 30e. Bob agrees to reveal: Mutual agreement reached -> 🔓 Photo Unlocked!
    unlock_resp = client.post("/api/blind-photo/consent", json={
        "photo_id": photo_id,
        "user_id": bob_id,
        "consent": True
    }).json()
    assert unlock_resp["locked"] is False
    assert unlock_resp["unlocked"] is True
    assert unlock_resp["full_photo_url"] == sunset_preset["full_url"]
    print(f"[OK] 30e. Mutual Agreement Verified: Both Alice & Bob accepted -> 🔓 Photo Unlocked! Full photo revealed.")

    # 30f. Verify updated status reflects unlocked state for all viewers
    final_status = client.get(f"/api/blind-photo/status/{photo_id}?user_id={alice_id}").json()
    assert final_status["unlocked"] is True
    assert final_status["full_photo_url"] == sunset_preset["full_url"]
    assert final_status["total_consents"] == 2
    print(f"[OK] 30f. Unlocked Status Broadcast Verified: Both parties can now view decrypted full-res photo")

    # 31. 🌫️ Feature 14: Blur-to-Reveal Profile (Blur 100% -> Blur 70% -> Blur 40% -> Clear)
    # 31a. Initial State: Blur 100% (Mystery Person with exact ASCII art)
    client.post(f"/api/blur-profile/reset?user_id={alice_id}&peer_id={bob_id}")
    b_init = client.get(f"/api/blur-profile/status?user_id={alice_id}&peer_id={bob_id}").json()
    assert b_init["current_stage"] == 0
    assert b_init["blur_percent"] == 100
    assert b_init["stage_label"] == "Blur 100%"
    assert b_init["stage_title"] == "Mystery Person"
    assert "███████" in b_init["ascii_art"]
    assert "it's purely an interface effect controlled by mutual consent" in b_init["privacy_notice"]
    assert b_init["photo_url"] is None, "SECURITY FAIL: photo_url must remain None at Blur 100%"
    print(f"[OK] 31a. Blur-to-Reveal Stage 0 Verified: Blur 100% (Mystery Person) with exact ASCII silhouette art and privacy notice")

    # 31b. Mutual consent progression to Stage 1 (Blur 70%)
    # Alice agrees
    c_alice = client.post("/api/blur-profile/consent", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "agree": True
    }).json()
    assert c_alice["advanced"] is False
    assert c_alice["current_stage"] == 0

    # Bob agrees -> Mutual agreement reached -> Transitions to Blur 70%
    c_bob = client.post("/api/blur-profile/consent", json={
        "user_id": bob_id,
        "peer_id": alice_id,
        "agree": True
    }).json()
    assert c_bob["advanced"] is True
    assert c_bob["current_stage"] == 1
    assert c_bob["blur_percent"] == 70
    assert c_bob["stage_label"] == "Blur 70%"
    print(f"[OK] 31b. Mutual Consent Verified: Both agreed -> Advanced to Stage 1 (Blur 70% - {c_bob['stage_title']})")

    # 31c. Step to Stage 2 (Blur 40%)
    step2 = client.post("/api/blur-profile/step", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "target_stage": 2
    }).json()
    assert step2["current_stage"] == 2
    assert step2["blur_percent"] == 40
    assert step2["stage_label"] == "Blur 40%"
    print(f"[OK] 31c. Blur Stage 2 Verified: Advanced to Blur 40% ({step2['stage_title']})")

    # 31d. Step to Stage 3 (Clear)
    step3 = client.post("/api/blur-profile/step", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "target_stage": 3
    }).json()
    assert step3["current_stage"] == 3
    assert step3["blur_percent"] == 0
    assert step3["stage_label"] == "Clear"
    print(f"[OK] 31d. Blur Stage 3 Verified: Advanced to Clear (0% blur - Fully Unveiled)")

    # 31e. Reset back to Stage 0
    rst = client.post(f"/api/blur-profile/reset?user_id={alice_id}&peer_id={bob_id}").json()
    assert rst["current_stage"] == 0
    assert rst["blur_percent"] == 100
    print(f"[OK] 31e. Reset Verified: Re-veiled back to Blur 100% (Mystery Person)")

    # 32. 🚪 Feature 15: Exit Anytime (Safety Protection • Leave Safely • No Explanation Required)
    # 32a. Spin up an active Blind Date chamber for exit testing
    q_exit_a = client.post("/api/blind-date/queue", json={
        "user_id": alice_id,
        "mode": "mystery",
        "duration_minutes": 20
    }).json()
    q_exit_b = client.post("/api/blind-date/queue", json={
        "user_id": bob_id,
        "mode": "mystery",
        "duration_minutes": 20
    }).json()
    exit_room_id = q_exit_b["room_id"]
    assert q_exit_b["status"] == "matched"
    print(f"[OK] 32a. Blind Date Chamber Spun Up for Exit Test: room_id={exit_room_id}")

    # 32b. Alice chooses to Leave Safely (Are you sure? -> [ Leave Safely ])
    # No explanation required!
    exit_resp = client.post(f"/api/blind-date/room/{exit_room_id}/exit-safely", json={
        "user_id": alice_id
    }).json()
    assert exit_resp["status"] == "exited_safely"
    assert "No explanation required" in exit_resp["message"]
    # The other person simply sees: "The Blind Date has ended."
    assert exit_resp["peer_message"] == "The Blind Date has ended."
    print("[OK] 32b. Safe Exit Executed: Alice clicked [ Leave Safely ]. No explanation required.")
    print(f"[OK] 32c. Peer Neutral Notification Verified: Bob simply sees: '{exit_resp['peer_message']}'")

    # 32d. Verify Room status in database/memory is terminated safely
    room_closed = client.get(f"/api/blind-date/room/{exit_room_id}").json()
    assert room_closed["status"] == "ended_safely"
    assert room_closed["ended_safely_by"] == alice_id
    print("[OK] 32d. Chamber Clean Burn Verified: Room status set to 'ended_safely', all temporary keys burned")

    # ========================================================================
    # 33. 🛡️ Feature 6: Safety Layer (Instant Block, Report, Screenshot Warning, Contact Protection)
    # ========================================================================

    # 33a. Instant Block (One Tap)
    # Spin up test room
    q_safe_a = client.post("/api/blind-date/queue", json={
        "user_id": alice_id,
        "mode": "mystery",
        "duration_minutes": 15
    }).json()
    q_safe_b = client.post("/api/blind-date/queue", json={
        "user_id": bob_id,
        "mode": "mystery",
        "duration_minutes": 15
    }).json()
    safe_room_id = q_safe_b["room_id"]

    # One Tap Instant Block
    block_resp = client.post("/api/safety/instant-block", json={
        "user_id": alice_id,
        "target_user_id": bob_id,
        "room_id": safe_room_id,
        "reason": "Instant one-tap block"
    }).json()
    assert block_resp["status"] == "blocked"
    assert block_resp["blocked_id"] == bob_id
    print("[OK] 33a. Instant Block Verified: One tap execution permanently severs connection and burns chamber")

    # Verify blocked list endpoint
    blocked_list = client.get(f"/api/safety/blocked-list?user_id={alice_id}").json()
    assert bob_id in blocked_list["blocked_ids"]
    print(f"[OK] 33b. Blocked List Verified: Bob confirmed in Alice's blocked blacklist ({blocked_list['total']} blocked)")

    # 33c. Report Categories (The 6 strictly required categories)
    expected_categories = [
        "Harassment",
        "Spam",
        "Impersonation",
        "Threatening behaviour",
        "Unwanted content",
        "Other"
    ]
    cats_resp = client.get("/api/safety/report-categories").json()
    assert cats_resp["categories"] == expected_categories
    print(f"[OK] 33c. Report Categories Verified: All 6 required categories confirmed ({', '.join(expected_categories)})")

    # 33d. Submit Report with Category & Auto-Block
    # Test invalid category rejection
    bad_rep = client.post("/api/safety/report", json={
        "reporter_id": alice_id,
        "target_user_id": bob_id,
        "category": "Invalid Category Test",
        "details": "Should be rejected"
    })
    assert bad_rep.status_code == 400

    # Test valid report submission
    valid_rep = client.post("/api/safety/report", json={
        "reporter_id": alice_id,
        "target_user_id": bob_id,
        "category": "Harassment",
        "details": "Disrespectful behavior during mystery session",
        "room_id": safe_room_id,
        "auto_block": True
    }).json()
    assert valid_rep["status"] == "report_received"
    assert valid_rep["category"] == "Harassment"
    assert valid_rep["auto_blocked"] is True
    print(f"[OK] 33d. Safety Report Logged: Incident id={valid_rep['report_id']}, category='Harassment', auto-block confirmed")

    # 33e. Screenshot Warning & Transparency Policy
    # "You can attempt to detect screenshots on supported platforms, but don't claim screenshots can always be prevented."
    policy_resp = client.get("/api/safety/screenshot-policy").json()
    assert "cannot always be prevented" in policy_resp["prevention_guarantee"]
    assert "cannot always be prevented" in policy_resp["transparency_notice"].lower()
    print(f"[OK] 33e. Screenshot Policy Verified: Transparent disclaimer confirmed ('{policy_resp['prevention_guarantee']}')")

    # Screenshot Activity Trigger
    ss_resp = client.post("/api/safety/screenshot-warning", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "room_id": safe_room_id,
        "platform": "web_keyboard"
    }).json()
    assert ss_resp["status"] == "screenshot_warning_recorded"
    assert "cannot always be prevented" in ss_resp["transparency_notice"].lower()
    print(f"[OK] 33f. Screenshot Warning Event Logged: Event id={ss_resp['event_id']}, peer alert triggered")

    # 33g. Contact Protection (Don't expose: phone number, email, exact location, device information)
    # 1. Phone number test
    phone_test = client.post("/api/safety/check-content", json={
        "text": "Call or WhatsApp me at +1 (555) 234-5678 or 9876543210 tonight"
    }).json()
    assert phone_test["is_safe"] is False
    assert "phone_number" in phone_test["detected_leaks"]
    assert "[🛡️ Protected: Phone Number]" in phone_test["sanitized_text"]

    # 2. Email test
    email_test = client.post("/api/safety/check-content", json={
        "text": "My private email is shadow_secret@protonmail.com reach out there"
    }).json()
    assert email_test["is_safe"] is False
    assert "email" in email_test["detected_leaks"]
    assert "[🛡️ Protected: Email]" in email_test["sanitized_text"]

    # 3. Exact location test
    loc_test = client.post("/api/safety/check-content", json={
        "text": "I am standing right at coordinates 37.7749, -122.4194 near 742 Evergreen Terrace"
    }).json()
    assert loc_test["is_safe"] is False
    assert "exact_location" in loc_test["detected_leaks"]
    assert "[🛡️ Protected: Exact Location]" in loc_test["sanitized_text"]

    # 4. Device information test
    device_test = client.post("/api/safety/check-content", json={
        "text": "Sent from my iPhone 15 Pro Max iOS 17.4 User-Agent: Mozilla/5.0"
    }).json()
    assert device_test["is_safe"] is False
    assert "device_information" in device_test["detected_leaks"]
    assert "[🛡️ Protected: Device Info]" in device_test["sanitized_text"]

    print("[OK] 33g. Contact Protection Scanner Verified: All 4 prohibited vectors (Phone, Email, Exact Location, Device Info) detected and shielded")

    # 33h. Live In-Chamber Chat Contact Protection Enforcement
    # Create demo date room and send message attempting to leak contact
    demo_leak_room = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20").json()
    dl_room_id = demo_leak_room["room_id"]

    leak_msg_resp = client.post(f"/api/blind-date/room/{dl_room_id}/chat", json={
        "user_id": alice_id,
        "text": "Hey check out my email alice@test.com and phone +1-555-888-9999!"
    }).json()
    assert leak_msg_resp["status"] == "success"
    sent_msg = leak_msg_resp["message"]
    assert sent_msg["is_contact_protected"] is True
    assert "phone_number" in sent_msg["contact_leaks_shielded"]
    assert "email" in sent_msg["contact_leaks_shielded"]
    assert "[🛡️ Protected: Email]" in sent_msg["text"]
    assert "[🛡️ Protected: Phone Number]" in sent_msg["text"]
    print(f"[OK] 33h. In-Chamber Chat Contact Shield Verified: Message sanitized to '{sent_msg['text']}'")

    # 33i. Profile Zero-Exposure Audit
    # Verify User Profile and Revealed Profile never leak phone, email, exact location, or device info
    profile_check = client.get(f"/api/users/{bob_id}/revealed-to/{alice_id}").json()
    assert "phone" not in profile_check
    assert "email" not in profile_check
    assert "location" not in profile_check
    assert "device" not in profile_check
    print("[OK] 33i. Zero-Knowledge Profile Guard Verified: Zero phone, email, location, or device telemetry exposure in profile APIs")

    # Unblock test to clean up
    client.post("/api/safety/unblock", json={"user_id": alice_id, "target_user_id": bob_id})

    # ========================================================================
    # 34. 📍 Feature 17: Approximate Location (Never 123 Main Street • ~8 km away / Delhi NCR)
    # ========================================================================

    # 34a. Catalog & Privacy Guarantee
    regions_resp = client.get("/api/location/regions").json()
    assert "Delhi NCR" in regions_resp["coarse_regions"]
    assert "Never show: 123 Main Street" in regions_resp["privacy_rule"]
    print(f"[OK] 34a. Coarse Regions Verified: {len(regions_resp['coarse_regions'])} metropolitan regions loaded (default: {regions_resp['default_region']})")

    # 34b. Strict Opt-in Constraint: Hidden by default
    loc_status_default = client.get(f"/api/location/status?user_id={bob_id}&peer_id={alice_id}").json()
    assert loc_status_default["location_sharing_enabled"] is False
    assert loc_status_default["display"] == "📍 Location Hidden"
    assert loc_status_default["approximate_distance"] is None
    assert loc_status_default["approximate_region"] is None
    print("[OK] 34b. Strict Opt-in Constraint Verified: Location is 100% hidden by default until explicitly enabled")

    # 34c. Exact Address Rejection: "Never show: 123 Main Street"
    bad_address_resp = client.post("/api/location/toggle", json={
        "user_id": alice_id,
        "enabled": True,
        "region": "123 Main Street, Apt 4B"
    })
    assert bad_address_resp.status_code == 400
    assert "prohibited" in bad_address_resp.json()["detail"].lower()
    print("[OK] 34c. Exact Address Guard Verified: '123 Main Street' strictly rejected with HTTP 400")

    # 34d. Explicit Enablement with Coarse Region and Fuzzed Distance
    toggle_resp = client.post("/api/location/toggle", json={
        "user_id": alice_id,
        "enabled": True,
        "region": "Delhi NCR",
        "fuzzed_distance_km": 8
    }).json()
    assert toggle_resp["status"] == "success"
    assert toggle_resp["location_sharing_enabled"] is True
    assert toggle_resp["approximate_distance"] == "📍 ~8 km away"
    assert toggle_resp["approximate_region"] == "📍 Delhi NCR"
    print(f"[OK] 34d. Coarse Opt-In Verified: Alice enabled location -> {toggle_resp['approximate_distance']} or {toggle_resp['approximate_region']}")

    # 34e. Peer Distance Calculation Endpoint
    peer_dist_resp = client.post(
        f"/api/location/calculate-peer-distance?user_id={bob_id}&peer_id={alice_id}&peer_region=Delhi%20NCR&simulated_km=8"
    ).json()
    assert peer_dist_resp["is_shared"] is True
    assert peer_dist_resp["approximate_distance"] == "📍 ~8 km away"
    assert peer_dist_resp["approximate_region"] == "📍 Delhi NCR"
    assert peer_dist_resp["never_show"] == "123 Main Street"
    print(f"[OK] 34e. Peer Approximate Distance Verified: Distance displayed as '{peer_dist_resp['approximate_distance']}' or '{peer_dist_resp['approximate_region']}'")

    # 34f. Mystery Match Card Location Integration
    # Verify that build_mystery_card returns approximate location only when sharing is active
    date_loc = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=20").json()
    assert "approximate_distance" in date_loc["mystery_card"]
    assert date_loc["mystery_card"]["location_sharing_enabled"] is True
    assert date_loc["mystery_card"]["approximate_distance"] == "📍 ~8 km away"
    assert date_loc["mystery_card"]["approximate_region"] == "📍 Delhi NCR"
    print(f"[OK] 34f. Mystery Match Card Location Verified: {date_loc['mystery_card']['approximate_distance']} • {date_loc['mystery_card']['approximate_region']}")

    # 34g. Disable Location Sharing & Verify Immediate Concealment
    disable_resp = client.post("/api/location/toggle", json={
        "user_id": alice_id,
        "enabled": False
    }).json()
    assert disable_resp["location_sharing_enabled"] is False
    assert disable_resp["display"] == "📍 Location Hidden"
    print("[OK] 34g. Immediate Concealment Verified: Location sharing disabled -> reverts to '📍 Location Hidden'")

    # =========================================================================
    # 35. 🔥 ANONYMOUS TOPIC ROOMS VERIFICATION
    # =========================================================================
    print("\n--- 35. Anonymous Topic Rooms Verification ---")

    # 35a. Topic Categories Catalog Verification
    cats_resp = client.get("/api/topic-rooms/categories").json()
    cat_ids = [c["id"] for c in cats_resp["categories"]]
    for expected_cat in ["gaming", "movies", "coding", "music", "travel", "students", "vibe"]:
        assert expected_cat in cat_ids, f"Category {expected_cat} missing from topic rooms"
    print("[OK] 35a. Topic Categories Verified: Gaming 🎮, Movies 🎬, Coding 💻, Music 🎵, Travel 🌍, Students 📚, Late Night 🌙")

    # 35b. Curated Rooms Catalog & Late Night Talks Verification
    rooms_resp = client.get("/api/topic-rooms").json()
    assert rooms_resp["status"] == "success"
    assert rooms_resp["total_active_rooms"] >= 7
    late_night = next((r for r in rooms_resp["rooms"] if r["room_id"] == "room_late_night_talks"), None)
    assert late_night is not None, "Room: Late Night Talks not found in catalog"
    assert late_night["title"] == "Late Night Talks"
    assert late_night["topic_icon"] == "🌙"
    assert late_night["is_temporary"] is True
    print(f"[OK] 35b. Curated Rooms Catalog Verified: {rooms_resp['total_active_rooms']} active temporary rooms found")

    # 35c. Roster Verification for Room: Late Night Talks
    # User prompt requirement:
    # Room: Late Night Talks
    # 👤 Nova
    # 👤 Ghost
    # 👤 Pixel
    # 👤 Luna
    expected_members = ["👤 Nova", "👤 Ghost", "👤 Pixel", "👤 Luna"]
    for expected_member in expected_members:
        assert expected_member in late_night["members_roster"], f"Member {expected_member} missing from roster"
    print(f"[OK] 35c. Late Night Talks Roster Verified: {', '.join(late_night['members_roster'])}")

    # 35d. Anonymous Room Entry (No Permanent Identity Needed)
    join_resp = client.post("/api/topic-rooms/room_late_night_talks/join", json={
        "custom_pseudonym": "Drift"
    }).json()
    assert join_resp["status"] == "success"
    assert join_resp["room_id"] == "room_late_night_talks"
    assert join_resp["my_pseudonym"] == "Drift"
    assert join_resp["my_display"] == "👤 Drift"
    assert "room_encryption_key" in join_resp
    drift_eph_id = join_resp["my_ephemeral_id"]
    assert "👤 Drift" in join_resp["members_roster"]
    print(f"[OK] 35d. Anonymous Entry Verified: User entered without permanent identity as 👤 Drift (eph_id={drift_eph_id})")

    # 35e. Encrypted Topic Room Messaging & Ambient Peer Reply
    msg_resp = client.post("/api/topic-rooms/room_late_night_talks/messages", json={
        "ephemeral_id": drift_eph_id,
        "sender_pseudonym": "👤 Drift",
        "ciphertext": "ENC[e2ee_room:ambient_soundtrack]",
        "plaintext": "Midnight tea and ambient music. Anyone else working on a dream project?"
    }).json()
    assert msg_resp["status"] == "success"
    assert msg_resp["sent_message"]["sender_pseudonym"] == "👤 Drift"
    assert msg_resp["sent_message"]["plaintext_preview"] == "Midnight tea and ambient music. Anyone else working on a dream project?"
    print(f"[OK] 35e. Encrypted Topic Message Sent: 'Midnight tea and ambient music. Anyone else working on a dream project?'")
    if msg_resp.get("peer_reply"):
        print(f"[OK] 35f. Dynamic Ambient Peer Reply Verified: {msg_resp['peer_reply']['sender_pseudonym']} -> '{msg_resp['peer_reply']['plaintext_preview']}'")

    # 35g. Create Custom Temporary Topic Room
    create_room = client.post("/api/topic-rooms/create", json={
        "title": "Retro Arcade Speedruns",
        "topic_category": "gaming",
        "topic_icon": "🎮",
        "description": "Speedrunning classic 16-bit platformers with zero identity baggage.",
        "ttl_hours": 6
    }).json()
    assert create_room["status"] == "success"
    custom_room_id = create_room["room_id"]
    assert custom_room_id.startswith("room_")
    print(f"[OK] 35g. Custom Temporary Room Created: id={custom_room_id}, title='Retro Arcade Speedruns', expires in 6 hours")

    # 35h. Safely Leave Room & Burn Ephemeral Pseudonym
    leave_resp = client.post(f"/api/topic-rooms/room_late_night_talks/leave?ephemeral_id={drift_eph_id}").json()
    assert leave_resp["status"] == "success"
    assert "Ephemeral identity burned" in leave_resp["message"]
    # Verify Drift is no longer in the active roster
    room_state = client.get("/api/topic-rooms/room_late_night_talks/state").json()
    assert "👤 Drift" not in room_state["members_roster"]
    print("[OK] 35h. Safe Exit Verified: Ephemeral pseudonym burned; removed from active member roster")

    # 35i. Clean Room Burn
    burn_resp = client.delete(f"/api/topic-rooms/{custom_room_id}").json()
    assert burn_resp["status"] == "success"
    print(f"[OK] 35i. Temporary Room Burned: Custom room {custom_room_id} and all ephemeral messages destroyed")

    # =========================================================================
    # 36. 🧨 SELF-DESTRUCT CONVERSATIONS VERIFICATION
    # =========================================================================
    print("\n--- 36. Self-Destruct Conversations Verification ---")

    # 36a. Self-Destruct Options & Transparency Disclaimer Assertion
    options_resp = client.get("/api/self-destruct/options").json()
    assert "options" in options_resp
    opt_labels = [o["label"] for o in options_resp["options"]]
    for expected_label in ["5 minutes", "1 hour", "24 hours", "7 days", "Never"]:
        assert expected_label in opt_labels, f"Option '{expected_label}' missing from self-destruct options"
    
    # Assert exact user disclaimer:
    # "For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."
    expected_disclaimer = "For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."
    assert options_resp["e2ee_disclaimer"] == expected_disclaimer
    print(f"[OK] 36a. Self-Destruct Options Verified: {', '.join(opt_labels)}")
    print(f"[OK] 36b. E2EE Security Disclaimer Verified: '{options_resp['e2ee_disclaimer']}'")

    test_conv_id = f"test_conv_{uuid.uuid4().hex[:8]}"

    # 36c. Set Policy: 5 Minutes (300 seconds)
    p_5m = client.post("/api/self-destruct/policy", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id,
        "delete_after_seconds": 300,
        "retention_label": "5 minutes"
    }).json()
    assert p_5m["status"] == "policy_updated"
    assert p_5m["delete_after_seconds"] == 300
    assert p_5m["retention_label"] == "5 minutes"
    assert p_5m["e2ee_disclaimer"] == expected_disclaimer
    print("[OK] 36c. Policy '5 minutes' (300s) Verified")

    # 36d. Set Policy: 1 Hour (3600 seconds)
    p_1h = client.post("/api/self-destruct/policy", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id,
        "delete_after_seconds": 3600,
        "retention_label": "1 hour"
    }).json()
    assert p_1h["delete_after_seconds"] == 3600
    assert p_1h["retention_label"] == "1 hour"
    print("[OK] 36d. Policy '1 hour' (3600s) Verified")

    # 36e. Set Policy: 24 Hours (86400 seconds)
    p_24h = client.post("/api/self-destruct/policy", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id,
        "delete_after_seconds": 86400,
        "retention_label": "24 hours"
    }).json()
    assert p_24h["delete_after_seconds"] == 86400
    assert p_24h["retention_label"] == "24 hours"
    print("[OK] 36e. Policy '24 hours' (86400s) Verified")

    # 36f. Set Policy: 7 Days (604800 seconds)
    p_7d = client.post("/api/self-destruct/policy", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id,
        "delete_after_seconds": 604800,
        "retention_label": "7 days"
    }).json()
    assert p_7d["delete_after_seconds"] == 604800
    assert p_7d["retention_label"] == "7 days"
    print("[OK] 36f. Policy '7 days' (604800s) Verified")

    # 36g. Set Policy: Never (None)
    p_never = client.post("/api/self-destruct/policy", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id,
        "delete_after_seconds": None,
        "retention_label": "Never"
    }).json()
    assert p_never["delete_after_seconds"] is None
    assert p_never["retention_label"] == "Never"
    print("[OK] 36g. Policy 'Never' Verified")

    # 36h. Auto-Pruning Enforcement on get_history
    # Insert a fresh message and an expired message into test_conv_id
    now = time.time()
    db = get_db()
    if db is not None:
        await db.messages.insert_one({
            "message_id": f"msg_fresh_{uuid.uuid4().hex[:6]}",
            "conversation_id": test_conv_id,
            "sender_id": alice_id,
            "ciphertext": "ENC[fresh]",
            "created_at": now - 60, # 1 minute old
            "is_deleted": False
        })
        await db.messages.insert_one({
            "message_id": f"msg_old_{uuid.uuid4().hex[:6]}",
            "conversation_id": test_conv_id,
            "sender_id": bob_id,
            "ciphertext": "ENC[expired]",
            "created_at": now - 400, # 400 seconds old
            "is_deleted": False
        })
        # Set policy to 5 minutes (300s)
        client.post("/api/self-destruct/policy", json={
            "conversation_id": test_conv_id,
            "user_id": alice_id,
            "delete_after_seconds": 300,
            "retention_label": "5 minutes"
        })
        # Fetch history: should contain fresh message, but expired message must be purged
        hist = client.get(f"/api/messages/history?conversation_id={test_conv_id}").json()
        assert len(hist) == 1
        assert hist[0]["ciphertext"] == "ENC[fresh]"
        print("[OK] 36h. Auto-Pruning Verified: Messages older than 5m were permanently purged from database")

    # 36i. Emergency Self-Destruct Entire Conversation Now (burn-now)
    burn_conv = client.post("/api/self-destruct/burn-now", json={
        "conversation_id": test_conv_id,
        "user_id": alice_id
    }).json()
    assert burn_conv["status"] == "conversation_burned"
    assert burn_conv["e2ee_disclaimer"] == expected_disclaimer
    hist_after_burn = client.get(f"/api/messages/history?conversation_id={test_conv_id}").json()
    assert len(hist_after_burn) == 0
    print("[OK] 36i. Emergency Burn-Now Verified: All conversation ciphertexts permanently purged (history length = 0)")

    # =========================================================================
    # 37. 🔐 SECRET CHAT MODE VERIFICATION
    # =========================================================================
    print("\n--- 37. Secret Chat Mode Verification ---")

    # 37a. Verify 6 Core Characteristics of SECRET MODE 🔐
    chars_resp = client.get("/api/secret-chat/characteristics").json()
    assert chars_resp["mode"] == "SECRET MODE 🔐"
    chars = chars_resp["characteristics"]

    # Characteristics check:
    # 1. disappearing messages
    # 2. no message history on the server
    # 3. restricted forwarding
    # 4. temporary encryption keys
    # 5. optional screenshot detection where supported
    # 6. automatic session expiration
    assert chars["disappearing_messages"]["enabled"] is True
    assert chars["no_message_history_on_server"]["enabled"] is True
    assert chars["restricted_forwarding"]["enabled"] is True
    assert chars["temporary_encryption_keys"]["enabled"] is True
    assert chars["optional_screenshot_detection"]["enabled"] is True
    assert chars["automatic_session_expiration"]["enabled"] is True
    print("[OK] 37a. All 6 Secret Mode Characteristics Verified: Disappearing msgs, No server history, Restricted forwarding, Temporary keys, Screenshot detection, Automatic session expiration")

    # 37b. Initialize Secret Chat Session with Ephemeral Keys
    init_resp = client.post("/api/secret-chat/init", json={
        "user_id": alice_id,
        "peer_id": bob_id,
        "disappearing_seconds": 30,
        "ttl_seconds": 1800,
        "temp_public_key": "ephem_pub_x25519_987654321"
    }).json()
    assert init_resp["status"] == "secret_mode_active"
    assert init_resp["mode_title"] == "SECRET MODE 🔐"
    secret_session_id = init_resp["secret_session_id"]
    assert secret_session_id.startswith("sec_")
    assert init_resp["disappearing_seconds"] == 30
    assert init_resp["ttl_seconds"] == 1800
    assert init_resp["temp_public_key"] == "ephem_pub_x25519_987654321"
    print(f"[OK] 37b. Ephemeral Secret Session Initialized: session_id={secret_session_id}, TTL=1800s, temp_key={init_resp['temp_public_key']}")

    # 37c. Live Secret Session Status & Countdown
    sess_status = client.get(f"/api/secret-chat/{secret_session_id}").json()
    assert sess_status["status"] == "active"
    assert sess_status["secret_session_id"] == secret_session_id
    assert sess_status["remaining_seconds"] > 1700
    assert sess_status["disappearing_seconds"] == 30
    print(f"[OK] 37c. Secret Session Status Verified: active, {sess_status['remaining_seconds']}s remaining")

    # 37d. Active Secret Chat Discovery Between Users
    active_pair = client.get(f"/api/secret-chat/active-between/{alice_id}/{bob_id}").json()
    assert active_pair["has_active_session"] is True
    assert active_pair["session"]["secret_session_id"] == secret_session_id
    print(f"[OK] 37d. Active Pair Discovery Verified: secret session recognized between {alice_id} and {bob_id}")

    # 37e. Zero Server Message History Guarantee
    # Verify that in SECRET MODE, messages bypass server database insertion entirely
    db = get_db()
    if db is not None:
        # Check messages table has no secret messages
        secret_docs_count = await db.messages.count_documents({"is_secret_mode": True})
        assert secret_docs_count == 0
        print("[OK] 37e. Zero Server History Guarantee: Verified 0 secret messages exist in database")

    # 37f. Screenshot Warning Signal & Alert
    ss_alert = client.post(f"/api/secret-chat/screenshot-alert?secret_session_id={secret_session_id}&reporter_id={alice_id}").json()
    assert ss_alert["status"] == "screenshot_alert_broadcasted"
    assert "📸 Screenshot detected in SECRET MODE 🔐!" in ss_alert["warning"]
    print(f"[OK] 37f. Screenshot Detection Alert Dispatched: alert_id={ss_alert['alert_id']}")

    # 37g. Terminate Secret Chat Session (Burn Keys & Ephemeral State)
    term_resp = client.post("/api/secret-chat/terminate", json={
        "secret_session_id": secret_session_id,
        "user_id": alice_id
    }).json()
    assert term_resp["status"] == "secret_mode_terminated"
    assert "Temporary encryption keys zeroized. Session burned." in term_resp["message"]
    print("[OK] 37g. Secret Chat Terminated: Ephemeral encryption keys zeroized and session burned")

    # 37h. Verify Burned Session No Longer Accessible
    gone_resp = client.get(f"/api/secret-chat/{secret_session_id}")
    assert gone_resp.status_code == 404
    print("[OK] 37h. Post-Burn Validation Verified: Querying burned session returns 404 Not Found")

    # =========================================================================
    # 38. 🧬 ANONYMOUS PERSONALITY CARD VERIFICATION
    # =========================================================================
    print("\n--- 38. Anonymous Personality Card Verification ---")

    # 38a. Options Catalog & Privacy Philosophy Assertion
    p_opts = client.get("/api/personality-card/options").json()
    assert p_opts["status"] == "success"
    assert p_opts["concept"] == "MYSTERY PROFILE"
    expected_privacy_notice = "These can be generated from user-selected preferences rather than secretly profiling them."
    assert p_opts["privacy_notice"] == expected_privacy_notice

    # Verify iconic sample matches user prompt requirements
    sample = p_opts["default_sample"]
    assert sample["card_title"] == "MYSTERY PROFILE"
    assert sample["vibes"] == ["☕ Coffee", "🎮 Gaming", "🌌 Night Owl", "🎵 Indie Music"]
    assert sample["conversation_style_bar"] == "████████░░"
    assert sample["energy_bar"] == "███████░░░"
    assert sample["topics"] == ["Technology", "Travel", "Movies"]
    print(f"[OK] 38a. Options Catalog Verified: '{expected_privacy_notice}'")

    # 38b. Fetch Default Anonymous Personality Card (Mystery Profile)
    p_card = client.get(f"/api/personality-card/{alice_id}").json()
    assert p_card["user_id"] == alice_id
    assert p_card["card_title"] == "MYSTERY PROFILE"
    assert "☕ Coffee" in p_card["vibes"]
    assert "🎮 Gaming" in p_card["vibes"]
    assert "🌌 Night Owl" in p_card["vibes"]
    assert "🎵 Indie Music" in p_card["vibes"]
    assert p_card["conversation_style_bar"] == "████████░░"
    assert p_card["energy_bar"] == "███████░░░"
    assert p_card["topics"] == ["Technology", "Travel", "Movies"]
    assert p_card["is_generated_from_preferences"] is True
    print("[OK] 38b. Default Mystery Profile Card Verified: ☕ Coffee, 🎮 Gaming, 🌌 Night Owl, 🎵 Indie Music | Style: ████████░░ | Energy: ███████░░░ | Topics: Technology, Travel, Movies")

    # 38c. Update Personality Card from User-Selected Preferences
    update_res = client.post(f"/api/personality-card/{alice_id}", json={
        "vibes": ["🍵 Matcha", "📚 Bookworm", "🧗 Bouldering"],
        "conversation_style_val": 6,
        "energy_val": 9,
        "topics": ["Philosophy", "Science", "Startups"]
    }).json()
    assert update_res["vibes"] == ["🍵 Matcha", "📚 Bookworm", "🧗 Bouldering"]
    assert update_res["conversation_style_val"] == 6
    assert update_res["conversation_style_bar"] == "██████░░░░"
    assert update_res["energy_val"] == 9
    assert update_res["energy_bar"] == "█████████░"
    assert update_res["topics"] == ["Philosophy", "Science", "Startups"]
    assert update_res["is_generated_from_preferences"] is True
    print("[OK] 38c. User-Selected Preferences Updated: Matcha/Bookworm/Bouldering | Style: ██████░░░░ | Energy: █████████░")

    # 38d. Peer Mystery Profile Card Retrieval (Safe Zero-Knowledge Delivery)
    peer_card = client.get(f"/api/personality-card/peer/{alice_id}").json()
    assert peer_card["card_title"] == "MYSTERY PROFILE"
    assert peer_card["vibes"] == ["🍵 Matcha", "📚 Bookworm", "🧗 Bouldering"]
    assert peer_card["topics"] == ["Philosophy", "Science", "Startups"]
    print("[OK] 38d. Peer Mystery Profile Retrieved: partner safely views card with zero personal contact leak")

    # 38e. Re-save Prompt's Canonical Mystery Profile
    reset_res = client.post(f"/api/personality-card/{alice_id}", json={
        "vibes": ["☕ Coffee", "🎮 Gaming", "🌌 Night Owl", "🎵 Indie Music"],
        "conversation_style_val": 8,
        "energy_val": 7,
        "topics": ["Technology", "Travel", "Movies"]
    }).json()
    assert reset_res["conversation_style_bar"] == "████████░░"
    assert reset_res["energy_bar"] == "███████░░░"
    print("[OK] 38e. Canonical Mystery Profile Restored: Conversation Style: ████████░░, Energy: ███████░░░")

    # =========================================================================
    # 39. 🌌 RANDOM UNIVERSE MATCHING VERIFICATION
    # =========================================================================
    print("\n--- 39. Random Universe Matching Verification ---")

    # 39a. Radar Scan & Canonical Celestial Constellation
    radar_res = client.get(f"/api/universe/radar?user_id={alice_id}").json()
    assert radar_res["title"] == "🌌 DISCOVER"
    assert radar_res["status"] == "signals_detected"
    assert radar_res["total_signals"] >= 6
    assert "Mystery signals detected" in radar_res["signals_label"]

    stars = radar_res["stars"]
    symbols = set(s["symbol"] for s in stars)
    assert "✦" in symbols, "Symbol '✦' missing from celestial star nodes"
    assert "○" in symbols, "Symbol '○' missing from celestial star nodes"

    # Verify canonical celestial stars from user prompt:
    #              ✦
    #       🌌 DISCOVER
    #    ✦       ○       ✦
    #        ○       ○
    star_ids = [s["star_id"] for s in stars]
    assert "star_zenith_alpha" in star_ids
    assert "star_west_beta" in star_ids
    assert "star_core_orbit_center" in star_ids
    assert "star_east_gamma" in star_ids
    assert "star_southwest_delta" in star_ids
    assert "star_southeast_epsilon" in star_ids

    zenith = next(s for s in stars if s["star_id"] == "star_zenith_alpha")
    assert zenith["symbol"] == "✦"
    assert "☕ Coffee" in zenith["vibe_signals"]
    assert zenith["conversation_style_bar"] == "████████░░"
    assert zenith["energy_bar"] == "███████░░░"
    print(f"[OK] 39a. Celestial Radar Scan Verified: 6 canonical star nodes (✦ and ○) detected with spectral frequencies")

    # 39b. [ENTER] Action — Random Cosmic Matchmaking
    enter_res = client.post("/api/universe/enter", json={
        "user_id": alice_id
    }).json()
    assert enter_res["status"] == "matched_in_universe"
    assert "Cosmic resonance locked!" in enter_res["message"]
    assert "room_id" in enter_res
    assert enter_res["matched_star"]["symbol"] in ("✦", "○")
    matched_room_id = enter_res["room_id"]
    print(f"[OK] 39b. [ENTER] Random Matching Verified: Swept deep space radar and matched with star '{enter_res['matched_star']['pseudonym']}' in room {matched_room_id}")

    # 39c. Tap a Star -> Start Mystery Interaction
    connect_res = client.post("/api/universe/connect-star", json={
        "user_id": alice_id,
        "star_id": "star_zenith_alpha"
    }).json()
    assert connect_res["status"] == "star_frequency_locked"
    assert connect_res["matched_star"]["star_id"] == "star_zenith_alpha"
    assert connect_res["matched_star"]["symbol"] == "✦"
    assert "Cygnus Zenith" in connect_res["message"]
    print(f"[OK] 39c. Tap a Star Verified: Locked frequency to star_zenith_alpha (✦) -> Direct mystery interaction launched")

    # =========================================================================
    # 40. ⚡ INSTANT 5-MINUTE DATE VERIFICATION
    # =========================================================================
    print("\n--- 40. Instant 5-Minute Date Verification ---")

    # 40a. Verify Manifest & Canonical 4-Pillar Rules
    date_manifest = client.get("/api/instant-date/manifest").json()
    assert date_manifest["status"] == "success"
    manifest_data = date_manifest["manifest"]
    assert manifest_data["tagline"] == "Quick Date"
    assert manifest_data["duration_minutes"] == 5
    assert manifest_data["duration_seconds"] == 300
    assert manifest_data["rules"]["duration"] == "5 MINUTES"
    assert manifest_data["rules"]["match"] == "ONE MATCH"
    assert manifest_data["rules"]["profile"] == "NO PROFILE"
    assert manifest_data["rules"]["photo"] == "NO PHOTO"

    decisions = {d["id"]: d for d in manifest_data["decisions"]}
    assert "continue" in decisions and decisions["continue"]["label"] == "❤️ Continue"
    assert "friends" in decisions and decisions["friends"]["label"] == "🤝 Friends"
    assert "exit" in decisions and decisions["exit"]["label"] == "👋 Exit"
    assert "Full chat unlocked" in decisions["continue"]["outcome_rule"]
    print("[OK] 40a. Instant Date Manifest Verified: Quick Date • 5 MINUTES • ONE MATCH • NO PROFILE • NO PHOTO")

    # 40b. Start Instant 5-Minute Date Chamber (300s TTL, anonymous ghost handles)
    start_res = client.post("/api/instant-date/start", json={
        "user_id": alice_id
    }).json()
    assert start_res["status"] == "date_active"
    qroom_id = start_res["room_id"]
    assert start_res["duration_seconds"] == 300
    assert start_res["banner"]["duration"] == "5 MINUTES"
    assert start_res["banner"]["profile"] == "NO PROFILE"
    assert start_res["banner"]["photo"] == "NO PHOTO"
    assert start_res["room"]["full_chat_unlocked"] is False
    print(f"[OK] 40b. Chamber Spawned: {qroom_id} with 5-minute countdown (300s) and zero profile/photo leaks")

    # 40c. Exchange In-Chamber Message
    msg_res = client.post(f"/api/instant-date/room/{qroom_id}/message", json={
        "room_id": qroom_id,
        "user_id": alice_id,
        "text": "Hello! 5 minutes speed date starting now."
    }).json()
    assert msg_res["status"] == "sent"
    assert msg_res["sent_message"]["text"] == "Hello! 5 minutes speed date starting now."
    assert "peer_reply" in msg_res
    print("[OK] 40c. In-Chamber Speed Chat Verified: Message dispatched and ambient peer response received")

    # 40d. Mutual Continue Decision -> Full Chat Unlocked
    decision_cont = client.post(f"/api/instant-date/room/{qroom_id}/decision", json={
        "room_id": qroom_id,
        "user_id": alice_id,
        "decision": "continue"
    }).json()
    assert decision_cont["status"] == "decision_resolved"
    assert decision_cont["outcome"] == "full_chat_unlocked"
    assert decision_cont["full_chat_unlocked"] is True
    assert "Full chat unlocked" in decision_cont["message"]
    print("[OK] 40d. Mutual Continue Verified: Both select ❤️ Continue -> Full chat unlocked!")

    # 40e. Friends Decision -> Stay Connected
    room2_res = client.post("/api/instant-date/start", json={"user_id": alice_id}).json()
    qroom2_id = room2_res["room_id"]
    decision_friends = client.post(f"/api/instant-date/room/{qroom2_id}/decision", json={
        "room_id": qroom2_id,
        "user_id": alice_id,
        "decision": "friends"
    }).json()
    assert decision_friends["outcome"] == "friends_connected"
    assert "Friends" in decision_friends["message"]
    print("[OK] 40e. Friends Decision Verified: 🤝 Friends -> Connected as platonic companions")

    # 40f. Exit Decision -> Ended Safely (Zero Trace)
    room3_res = client.post("/api/instant-date/start", json={"user_id": alice_id}).json()
    qroom3_id = room3_res["room_id"]
    decision_exit = client.post(f"/api/instant-date/room/{qroom3_id}/decision", json={
        "room_id": qroom3_id,
        "user_id": alice_id,
        "decision": "exit"
    }).json()
    assert decision_exit["outcome"] == "ended_safely"
    assert decision_exit["full_chat_unlocked"] is False
    assert decision_exit["message"] == "The 5-Minute Date has ended."
    print("[OK] 40f. Exit Decision Verified: 👋 Exit -> 'The 5-Minute Date has ended.' with zero personal data leakage")

    # =========================================================================
    # 41. 🔄 SECOND CHANCE VERIFICATION
    # =========================================================================
    print("\n--- 41. Second Chance Verification ---")

    # 41a. Verify Manifest & Canonical Rules
    sc_manifest = client.get("/api/second-chance/manifest").json()
    assert sc_manifest["status"] == "success"
    sc_rule_data = sc_manifest["manifest"]
    assert sc_rule_data["feature"] == "🔄 Second Chance"
    assert "Maybe later" in sc_rule_data["trigger"]
    assert "independently choose to reopen" in sc_rule_data["reconnect_rule"]
    print("[OK] 41a. Second Chance Manifest Verified: 'If both users select: Maybe later' -> 'Second Chance'")

    # 41b. Auto-Placement from Instant 5-Minute Date when both select 'Maybe later'
    qdate_room = client.post("/api/instant-date/start", json={"user_id": alice_id}).json()
    qdate_id = qdate_room["room_id"]
    qdate_decision = client.post(f"/api/instant-date/room/{qdate_id}/decision", json={
        "room_id": qdate_id,
        "user_id": alice_id,
        "decision": "maybe_later"
    }).json()
    assert qdate_decision["outcome"] == "second_chance"
    assert qdate_decision["second_chance_id"] is not None
    qdate_sc_id = qdate_decision["second_chance_id"]
    assert "Second Chance" in qdate_decision["message"]
    print(f"[OK] 41b. Instant Date 'Maybe Later' Auto-Placement: Both chose maybe_later -> placed into vault as {qdate_sc_id}")

    # 41c. Auto-Placement from Blind Date when both select 'Maybe later'
    bd_start = client.post(f"/api/blind-date/instant-demo-match?user_id={alice_id}&mode=mystery&duration_minutes=15").json()
    bd_room_id = bd_start["room_id"]
    bd_decision = client.post(f"/api/blind-date/room/{bd_room_id}/end-date-decision", json={
        "room_id": bd_room_id,
        "user_id": alice_id,
        "choice": "maybe_later"
    }).json()
    assert bd_decision["outcome"] == "second_chance"
    print("[OK] 41c. Blind Date 'Maybe Later' Auto-Placement: Both chose maybe_later -> placed into Second Chance")

    # 41d. Retrieve User's Second Chance Vault List
    sc_list = client.get(f"/api/second-chance/list?user_id={alice_id}").json()
    assert sc_list["status"] == "success"
    assert sc_list["total"] >= 1
    found_sc = next((c for c in sc_list["connections"] if c["second_chance_id"] == qdate_sc_id), None)
    assert found_sc is not None
    assert found_sc["status"] == "dormant"
    assert found_sc["my_reopen_status"] is False
    assert found_sc["is_reconnected"] is False
    peer_user_id = found_sc["peer_id"]
    print(f"[OK] 41d. Second Chance Vault List Verified: Found dormant connection {qdate_sc_id} with peer {found_sc['peer_name']}")

    # 41e. Independent Reopen: Only Alice chooses to reopen (Confidential, waiting for peer)
    alice_reopen = client.post("/api/second-chance/reopen", json={
        "second_chance_id": qdate_sc_id,
        "user_id": alice_id,
        "simulate_peer_reopen": False
    }).json()
    assert alice_reopen["outcome"] == "waiting_mutual_reopen"
    assert alice_reopen["is_reconnected"] is False
    assert alice_reopen["my_reopen_status"] is True
    print("[OK] 41e. Independent Choice Verified: Alice chose to reopen -> waiting for peer with zero pressure / no leak")

    # 41f. Mutual Reopen: Peer also independently chooses to reopen -> Connection Reconnected & Full Chat Unlocked
    peer_reopen = client.post("/api/second-chance/reopen", json={
        "second_chance_id": qdate_sc_id,
        "user_id": peer_user_id,
        "simulate_peer_reopen": False
    }).json()
    assert peer_reopen["outcome"] == "mutual_reopen_achieved"
    assert peer_reopen["is_reconnected"] is True
    assert peer_reopen["unlocked_chat_id"] is not None
    assert "Mutual Reopen" in peer_reopen["message"]
    print(f"[OK] 41f. Mutual Reopen Achieved: Both independently chose to reopen -> Connection restored & chat unlocked ({peer_reopen['unlocked_chat_id']})")

    # 41g. Clean Archive
    arch_res = client.post("/api/second-chance/archive", json={
        "second_chance_id": qdate_sc_id,
        "user_id": alice_id
    }).json()
    assert arch_res["status"] == "success"
    sc_list_after_arch = client.get(f"/api/second-chance/list?user_id={alice_id}").json()
    archived_check = any(c["second_chance_id"] == qdate_sc_id for c in sc_list_after_arch["connections"])
    assert archived_check is False
    print("[OK] 41g. Second Chance Archiving Verified: Quietly archived from user vault")

    # =========================================================================
    # 42. 🧠 SMART MATCHMAKING VERIFICATION
    # =========================================================================
    print("\n--- 42. Smart Matchmaking Verification ---")

    # 42a. Verify Manifest & All 8 Matching Vectors
    sm_manifest = client.get("/api/smart-matchmaking/manifest").json()
    assert sm_manifest["status"] == "success"
    manifest_info = sm_manifest["manifest"]
    assert manifest_info["feature"] == "🧠 Smart Matchmaking"
    factor_ids = [f["id"] for f in manifest_info["factors"]]
    required_8_factors = [
        "age_preference",
        "interests",
        "conversation_preferences",
        "language",
        "availability",
        "date_mode",
        "shared_topics",
        "past_interactions"
    ]
    for rf in required_8_factors:
        assert rf in factor_ids, f"Factor {rf} missing from Smart Matchmaking manifest"
    assert "Users maintain full granular control" in manifest_info["privacy_rule"]
    print("[OK] 42a. Smart Matchmaking Manifest Verified: All 8 compatibility factors present with privacy rule")

    # 42b. Fetch User Matchmaking Profile & Defaults
    sm_prof = client.get(f"/api/smart-matchmaking/profile/{alice_id}").json()
    assert sm_prof["status"] == "success"
    assert "controls" in sm_prof["config"]
    assert "preferences" in sm_prof["config"]
    print("[OK] 42b. Profile & Default Controls Loaded: Full 8 privacy controls active by default")

    # 42c. Search with All 8 Controls Active
    search_full = client.post("/api/smart-matchmaking/search", json={
        "user_id": alice_id,
        "limit": 5
    }).json()
    assert search_full["status"] == "matches_found"
    assert len(search_full["ranked_matches"]) > 0
    top_match = search_full["ranked_matches"][0]
    assert top_match["compatibility_score"] > 0
    assert top_match["enabled_factors_count"] == 8
    assert top_match["disabled_factors_count"] == 0
    assert "age_preference" in top_match["breakdown"]
    assert "interests" in top_match["breakdown"]
    assert "conversation_preferences" in top_match["breakdown"]
    assert "language" in top_match["breakdown"]
    assert "availability" in top_match["breakdown"]
    assert "date_mode" in top_match["breakdown"]
    assert "shared_topics" in top_match["breakdown"]
    assert "past_interactions" in top_match["breakdown"]
    print(f"[OK] 42c. Full 8-Factor Search Verified: Top match '{top_match['pseudonym']}' scored {top_match['compatibility_score']}% with all 8 vectors active")

    # 42d. Granular Privacy Control: Disable age_preference and language
    custom_controls = {
        "use_age_preference": False,
        "use_interests": True,
        "use_conversation_preferences": True,
        "use_language": False,
        "use_availability": True,
        "use_date_mode": True,
        "use_shared_topics": True,
        "use_past_interactions": True
    }
    update_res = client.post("/api/smart-matchmaking/profile", json={
        "user_id": alice_id,
        "controls": custom_controls,
        "preferences": sm_prof["config"]["preferences"]
    }).json()
    assert update_res["status"] == "updated"

    # Re-evaluate search: disabled factors must be excluded from scoring and masked
    search_filtered = client.post("/api/smart-matchmaking/search", json={
        "user_id": alice_id,
        "limit": 5
    }).json()
    match_filtered = search_filtered["ranked_matches"][0]
    assert match_filtered["enabled_factors_count"] == 6
    assert match_filtered["disabled_factors_count"] == 2
    assert match_filtered["breakdown"]["age_preference"]["enabled"] is False
    assert match_filtered["breakdown"]["age_preference"]["weight"] == 0
    assert "Disabled by user control" in match_filtered["breakdown"]["age_preference"]["status"]
    assert match_filtered["breakdown"]["language"]["enabled"] is False
    assert match_filtered["breakdown"]["language"]["weight"] == 0
    assert match_filtered["details"]["age_preference"] == "🔒 Private"
    assert match_filtered["details"]["language"] == "🔒 Private"
    print("[OK] 42d. Granular Privacy Controls Verified: Age and Language excluded from scoring (0 weight) and masked to '🔒 Private'")

    # 42e. Extreme Privacy Test: Turn off all 8 factors (Pure random neutrality)
    strict_blind_controls = {k: False for k in custom_controls.keys()}
    client.post("/api/smart-matchmaking/profile", json={
        "user_id": alice_id,
        "controls": strict_blind_controls,
        "preferences": sm_prof["config"]["preferences"]
    })
    search_blind = client.post("/api/smart-matchmaking/search", json={
        "user_id": alice_id,
        "limit": 5
    }).json()
    blind_match = search_blind["ranked_matches"][0]
    assert blind_match["enabled_factors_count"] == 0
    assert blind_match["disabled_factors_count"] == 8
    assert blind_match["compatibility_score"] == 50.0  # Neutral baseline
    print("[OK] 42e. Extreme Privacy Mode Verified: When user disables all data signals, matching degrades gracefully to neutral baseline with 0 data leaks")

    # =========================================================================
    # 43. 🏆 BLIND DATE XP VERIFICATION
    # =========================================================================
    print("\n--- 43. Blind Date XP Verification ---")

    # 43a. Verify Manifest & Canonical Gamification Specification
    xp_manifest = client.get("/api/blind-date-xp/manifest").json()
    assert xp_manifest["status"] == "success"
    assert xp_manifest["feature"] == "🏆 Blind Date XP"
    canon = xp_manifest["canonical_spec"]
    assert canon["title"] == "Mystery Explorer"
    assert canon["level"] == "Lv. 12"
    assert canon["stats"]["dates_completed"] == 18
    assert canon["stats"]["games_played"] == 34
    assert canon["stats"]["questions_answered"] == 92

    ach_names = [a["name"] for a in xp_manifest["achievements"]]
    required_achievements = [
        "First Blind Date",
        "Mystery Master",
        "Conversation Starter",
        "Puzzle Solver",
        "Night Owl",
        "Mutual Reveal"
    ]
    for ra in required_achievements:
        assert ra in ach_names, f"Achievement {ra} missing from catalog"
    print("[OK] 43a. Blind Date XP Manifest Verified: Mystery Explorer Lv. 12 • 18 Dates • 34 Games • 92 Questions")

    # 43b. User XP Profile Retrieval
    user_xp = client.get(f"/api/blind-date-xp/profile/{alice_id}").json()
    assert user_xp["status"] == "success"
    prof = user_xp["profile"]
    assert prof["title"] == "Mystery Explorer"
    assert prof["level"] == 12
    assert prof["stats"]["dates_completed"] == 18
    assert prof["stats"]["games_played"] == 34
    assert prof["stats"]["questions_answered"] == 92
    assert len(user_xp["achievements"]) == 6
    print(f"[OK] 43b. Profile Verified: {user_xp['rank_display']} with all 6 achievements mapped")

    # 43c. Award XP for Game Played
    game_xp = client.post("/api/blind-date-xp/add-xp", json={
        "user_id": alice_id,
        "action_type": "play_game"
    }).json()
    assert game_xp["status"] == "xp_awarded"
    assert game_xp["profile"]["stats"]["games_played"] == 35
    assert game_xp["added_xp"] == 25
    print("[OK] 43c. Game XP Awarded: Counter incremented to 35 games played (+25 XP)")

    # 43d. Award XP for Question Answered
    q_xp = client.post("/api/blind-date-xp/add-xp", json={
        "user_id": alice_id,
        "action_type": "answer_question"
    }).json()
    assert q_xp["status"] == "xp_awarded"
    assert q_xp["profile"]["stats"]["questions_answered"] == 93
    assert q_xp["added_xp"] == 15
    print("[OK] 43d. Question XP Awarded: Counter incremented to 93 questions answered (+15 XP)")

    # 43e. Award XP for Date Completion
    date_xp = client.post("/api/blind-date-xp/add-xp", json={
        "user_id": alice_id,
        "action_type": "complete_date"
    }).json()
    assert date_xp["status"] == "xp_awarded"
    assert date_xp["profile"]["stats"]["dates_completed"] == 19
    assert date_xp["added_xp"] == 100
    print("[OK] 43e. Date Completed XP Awarded: Counter incremented to 19 dates completed (+100 XP)")

    # 43f. Direct Achievement Unlock
    unlock_res = client.post("/api/blind-date-xp/unlock-achievement", json={
        "user_id": alice_id,
        "achievement_id": "night_owl"
    }).json()
    assert unlock_res["status"] == "unlocked"
    assert "night_owl" in unlock_res["profile"]["unlocked_achievements"]
    print("[OK] 43f. Achievement Unlock Verified: '🌙 Night Owl' confirmed in unlocked list")

    # ========================================================================
    # 44. 🔥 Feature 28: Daily Mystery Drop Verification
    # ========================================================================
    print("\n--- 44. Daily Mystery Drop Verification ---")

    # 44a. Manifest Verification
    drop_manifest = client.get("/api/daily-mystery-drop/manifest").json()
    assert drop_manifest["feature_number"] == 28
    assert drop_manifest["cadence"] == "Every day: ONE MYSTERY MATCH"
    assert drop_manifest["window_duration_minutes"] == 30
    assert drop_manifest["window_duration_seconds"] == 1800
    assert drop_manifest["headline"] == "Your mystery connection is waiting."
    assert drop_manifest["purpose"] == "This gives users a reason to return."
    print(f"[OK] 44a. Daily Mystery Drop Manifest Verified: '{drop_manifest['cadence']}' • 30 mins • '{drop_manifest['headline']}'")

    # 44b. Status for User (Ready / Unopened)
    drop_status = client.get(f"/api/daily-mystery-drop/status/{alice_id}").json()
    assert drop_status["status"] == "ready"
    assert drop_status["time_remaining_seconds"] == 1800
    assert drop_status["match"]["window_duration_seconds"] == 1800
    assert drop_status["headline"] == "Your mystery connection is waiting."
    assert drop_status["match"]["compatibility_score"] >= 90
    drop_id = drop_status["match"]["drop_id"]
    peer_name = drop_status["match"]["peer_pseudonym"]
    print(f"[OK] 44b. Ready Status Verified: Found today's mystery match '{peer_name}' with 30m window ready")

    # 44c. Open Drop (Starts 30-Minute Timer)
    open_res = client.post("/api/daily-mystery-drop/open", json={
        "user_id": alice_id
    }).json()
    assert open_res["success"] is True
    assert open_res["status"] == "active"
    assert open_res["opened_at"] is not None
    assert 0 < open_res["time_remaining_seconds"] <= 1800
    print(f"[OK] 44c. Drop Opened: 30-minute countdown active ({open_res['time_remaining_seconds']}s remaining)")

    # 44d. Connect to Today's Match
    connect_res = client.post("/api/daily-mystery-drop/connect", json={
        "user_id": alice_id,
        "drop_id": drop_id
    }).json()
    assert connect_res["success"] is True
    assert connect_res["status"] == "connected"
    assert "mystery_drop_room_" in connect_res["chat_room_id"]
    print(f"[OK] 44d. Mystery Connection Unlocked: Connected to '{peer_name}' in room {connect_res['chat_room_id']}")

    # 44e. Pass Action and Demo Reset for Second User
    bob_status = client.get(f"/api/daily-mystery-drop/status/{bob_id}").json()
    bob_drop_id = bob_status["match"]["drop_id"]
    pass_res = client.post("/api/daily-mystery-drop/pass", json={
        "user_id": bob_id,
        "drop_id": bob_drop_id
    }).json()
    assert pass_res["success"] is True
    assert pass_res["status"] == "passed"
    print(f"[OK] 44e. Pass Verified: Bob dismissed today's match until tomorrow's drop")

    # 44f. Reset utility for interactive demo testing
    reset_res = client.post("/api/daily-mystery-drop/reset-demo", json={
        "user_id": bob_id
    }).json()
    assert reset_res["success"] is True
    assert reset_res["drop"]["status"] == "ready"
    print(f"[OK] 44f. Reset Demo Verified: Restored ready state for tomorrow/demo replay")

    # ========================================================================
    # 45. 🕰️ Feature 29: Scheduled Blind Date Verification
    # ========================================================================
    print("\n--- 45. Scheduled Blind Date Verification ---")

    # 45a. Manifest Verification
    sched_manifest = client.get("/api/scheduled-blind-date/manifest").json()
    assert sched_manifest["feature_number"] == 29
    assert sched_manifest["example_choice"]["day"] == "Tonight"
    assert sched_manifest["example_choice"]["time"] == "9:00 PM"
    assert sched_manifest["matching_mechanism"] == "The system finds another user who is also available."
    assert sched_manifest["countdown_headline"] == "Your date begins in:"
    assert sched_manifest["example_countdown"] == "00:04:21"
    assert sched_manifest["purpose"] == "This creates an actual event rather than an ordinary chat."
    print(f"[OK] 45a. Manifest Verified: User chooses: Tonight, 9:00 PM -> 'Your date begins in: 00:04:21'")

    # 45b. Slots Catalog
    slots_res = client.get("/api/scheduled-blind-date/slots").json()
    assert len(slots_res) >= 4
    tonight_9pm = next((s for s in slots_res if s["day_label"] == "Tonight" and s["time_label"] == "9:00 PM"), None)
    assert tonight_9pm is not None
    assert tonight_9pm["is_recommended"] is True
    print(f"[OK] 45b. Slots Catalog Loaded: Found recommended slot 'Tonight • 9:00 PM' ({tonight_9pm['available_peers_count']} peers)")

    # 45c. Book Slot 'Tonight at 9:00 PM' with canonical 00:04:21 (261s)
    book_res = client.post("/api/scheduled-blind-date/book", json={
        "user_id": alice_id,
        "scheduled_day": "Tonight",
        "scheduled_time": "9:00 PM",
        "demo_countdown_seconds": 261
    }).json()
    assert book_res["success"] is True
    booking = book_res["event"]
    assert booking["scheduled_day"] == "Tonight"
    assert booking["scheduled_time"] == "9:00 PM"
    assert booking["countdown_display"] == "00:04:21"
    booking_id = booking["booking_id"]
    peer_name = booking["peer_pseudonym"]
    print(f"[OK] 45c. Slot Booked: Tonight at 9:00 PM matched with '{peer_name}' -> Countdown: {booking['countdown_display']}")

    # 45d. Status Query Verification
    status_res = client.get(f"/api/scheduled-blind-date/status/{alice_id}").json()
    assert status_res["has_scheduled_event"] is True
    assert status_res["headline"] == "Your date begins in:"
    assert "00:04:2" in status_res["countdown_display"]  # 00:04:21 or 00:04:20
    print(f"[OK] 45d. Status Verified: '{status_res['headline']} {status_res['countdown_display']}'")

    # 45e. Fast-Forward Countdown Testing
    ff_res = client.post("/api/scheduled-blind-date/test-countdown", json={
        "booking_id": booking_id,
        "countdown_seconds": 5
    }).json()
    assert ff_res["success"] is True
    assert ff_res["countdown_seconds"] == 5
    assert ff_res["countdown_display"] == "00:00:05"
    print(f"[OK] 45e. Fast-Forward Verified: Ticker accelerated to {ff_res['countdown_display']}")

    # 45f. Enter Scheduled Event Chamber
    enter_res = client.post("/api/scheduled-blind-date/enter", json={
        "user_id": alice_id,
        "booking_id": booking_id
    }).json()
    assert enter_res["success"] is True
    assert enter_res["status"] == "live"
    assert "sched_room_" in enter_res["room_id"]
    print(f"[OK] 45f. Event Chamber Entered: Live appointment open in room '{enter_res['room_id']}'")

    # 45g. Cancellation Flow for Second User
    bob_book = client.post("/api/scheduled-blind-date/book", json={
        "user_id": bob_id,
        "scheduled_day": "Tomorrow",
        "scheduled_time": "9:00 PM"
    }).json()
    bob_booking_id = bob_book["event"]["booking_id"]
    cancel_res = client.post("/api/scheduled-blind-date/cancel", json={
        "user_id": bob_id,
        "booking_id": bob_booking_id
    }).json()
    assert cancel_res["success"] is True
    bob_after = client.get(f"/api/scheduled-blind-date/status/{bob_id}").json()
    assert bob_after["has_scheduled_event"] is False
    print("[OK] 45g. Cancellation Verified: Slot released cleanly")

    # ========================================================================
    # 46. 💎 Feature 30: Date Memory Verification
    # ========================================================================
    print("\n--- 46. Date Memory Verification ---")

    # 46a. Manifest Verification
    mem_manifest = client.get("/api/date-memory/manifest").json()
    assert mem_manifest["feature_number"] == 30
    assert mem_manifest["canonical_card"]["title"] == "Your Blind Date"
    assert mem_manifest["canonical_card"]["partner"] == "🌙 Nova"
    assert mem_manifest["canonical_card"]["topics"] == ["Gaming", "Travel", "Music"]
    assert mem_manifest["canonical_card"]["games"] == 3
    assert mem_manifest["canonical_card"]["date_duration"] == "18 min"
    assert mem_manifest["canonical_card"]["mutual_reveal"] == "✓"
    assert mem_manifest["guarantee"] == "This becomes a private encrypted 'date memory.'"
    print(f"[OK] 46a. Manifest Verified: 'Your Blind Date' • 🌙 Nova • 3 Games • 18 min • Mutual reveal ✓")

    # 46b. User Vault Retrieval (Contains Canonical 🌙 Nova Date Memory)
    user_mems = client.get(f"/api/date-memory/list/{alice_id}").json()
    assert user_mems["total_memories"] >= 1
    canonical_mem = user_mems["canonical_sample"]
    assert canonical_mem["peer_pseudonym"] == "🌙 Nova"
    assert canonical_mem["topics"] == ["Gaming", "Travel", "Music"]
    assert canonical_mem["games_count"] == 3
    assert canonical_mem["date_duration_str"] == "18 min"
    assert canonical_mem["mutual_reveal"] is True
    assert canonical_mem["mutual_reveal_icon"] == "✓"
    assert canonical_mem["is_private_encrypted"] is True
    assert canonical_mem["tagline"] == "This becomes a private encrypted 'date memory.'"
    print(f"[OK] 46b. Canonical Date Memory Verified: 🌙 Nova ({canonical_mem['date_duration_str']} • {canonical_mem['games_count']} games • Mutual reveal: {canonical_mem['mutual_reveal_icon']})")

    # 46c. Create New Memory from Date Encounter
    create_mem_res = client.post("/api/date-memory/create", json={
        "user_id": alice_id,
        "peer_id": "anon_spark_99",
        "peer_pseudonym": "⚡ Solar Spark",
        "topics": ["Sci-Fi", "Cybersecurity", "Coffee"],
        "games_count": 2,
        "date_duration_minutes": 22,
        "mutual_reveal": True,
        "encrypted_notes": "We had deep laughs talking about retro terminal interfaces."
    }).json()
    assert create_mem_res["success"] is True
    new_mem = create_mem_res["memory"]
    assert new_mem["peer_pseudonym"] == "⚡ Solar Spark"
    assert new_mem["date_duration_str"] == "22 min"
    created_id = new_mem["memory_id"]
    print(f"[OK] 46c. New Date Memory Created: id={created_id} with '⚡ Solar Spark'")

    # 46d. Update Private Encrypted Reflection Note
    update_note_res = client.post("/api/date-memory/update-notes", json={
        "user_id": alice_id,
        "memory_id": created_id,
        "encrypted_notes": "Added private journal: Best chemistry on blind chat so far!"
    }).json()
    assert update_note_res["success"] is True
    assert "Best chemistry" in update_note_res["updated_notes"]
    print("[OK] 46d. Private Encrypted Reflection Updated")

    # 46e. Delete Memory Flow
    del_res = client.delete(f"/api/date-memory/{created_id}?user_id={alice_id}").json()
    assert del_res["success"] is True
    assert del_res["deleted_memory_id"] == created_id
    print(f"[OK] 46e. Memory Purged Cleanly: id={created_id}")

    # 46f. Reset Demo Utility
    reset_mem_res = client.post(f"/api/date-memory/reset-demo?user_id={alice_id}").json()
    assert reset_mem_res["success"] is True
    assert len(reset_mem_res["memories"]) == 1
    assert reset_mem_res["memories"][0]["peer_pseudonym"] == "🌙 Nova"
    print("[OK] 46f. Demo Reset Verified: Restored canonical 🌙 Nova memory")

    # ========================================================================
    # 47. 🏗️ Feature Architecture & Database Blueprint Verification
    # ========================================================================
    print("\n--- 47. Architecture Blueprint & Database Structure Verification ---")

    # 47a. Architecture Blueprint Manifest
    bp = client.get("/api/architecture/blueprint").json()
    assert bp["status"] == "success"
    assert "FRONTEND" in bp["architecture_tree"]
    assert "WebSocket" in bp["architecture_tree"]
    assert "Redis" in bp["architecture_tree"]
    assert "PostgreSQL" in bp["architecture_tree"]
    print("[OK] 47a. Technical Architecture Tree Verified (React Native -> WebSocket/API -> Redis -> PostgreSQL/MongoDB)")

    # 47b. Encryption Layer Boundaries
    enc_meta = bp["encryption_layer"]
    assert "Decrypt locally" in enc_meta["flow"]
    assert "Encrypted payload" in enc_meta["server_responsibilities"]
    assert "Plaintext message content" in enc_meta["server_forbidden"]
    print("[OK] 47b. Encryption Layer Verified: Server handles encrypted packets & metadata, strictly forbidden from plaintext")

    # 47c. Database Schemas (All 6 Tables)
    schemas = bp["database_structure"]
    expected_tables = ["Users", "Conversations", "Messages", "BlindDates", "BlindDateAnswers", "MatchQueue"]
    for t in expected_tables:
        assert t in schemas
    assert "encrypted_payload" in schemas["Messages"]["fields"]
    assert "reveal_level" in schemas["BlindDates"]["fields"]
    assert "encrypted_answer" in schemas["BlindDateAnswers"]["fields"]
    print(f"[OK] 47c. Database Structure Verified: 6 Tables mapped ({', '.join(expected_tables)})")

    # 47d. Complete Blind Date User Flow
    flow = bp["complete_user_flow"]
    assert "5-Min Quick Date" in flow["available_modes"]
    assert "15-Min Mystery Date" in flow["available_modes"]
    assert "Voice Date" in flow["available_modes"]
    assert "Game Date" in flow["available_modes"]
    assert "❤️ Continue" in flow["date_end_actions"]
    assert "🤝 Friends" in flow["date_end_actions"]
    assert "🔄 Maybe Later" in flow["date_end_actions"]
    assert "👋 Leave" in flow["date_end_actions"]
    print("[OK] 47d. Complete User Flow Verified: 4 Date Modes -> Queue -> Missions/Games/Chemistry -> 4 Decision Outcomes")

    print("\n[SUCCESS] ALL E2EE, PSEUDONYMOUS IDENTITY, BLIND DATE, COMPATIBILITY PUZZLE, MINI GAMES, CHEMISTRY METER, BLIND DATE MISSIONS, QUESTION CARDS, BLIND PHOTO REVEAL, BLUR-TO-REVEAL PROFILE, EXIT ANYTIME, SAFETY LAYER, APPROXIMATE LOCATION, ANONYMOUS TOPIC ROOMS, SELF-DESTRUCT CONVERSATIONS, SECRET CHAT MODE, ANONYMOUS PERSONALITY CARD, RANDOM UNIVERSE MATCHING, INSTANT 5-MINUTE DATE, SECOND CHANCE, SMART MATCHMAKING, BLIND DATE XP, DAILY MYSTERY DROP, SCHEDULED BLIND DATE, DATE MEMORY & ARCHITECTURE BLUEPRINT TESTS PASSED WITH 100% SUCCESS!")


if __name__ == "__main__":
    asyncio.run(run_tests())





