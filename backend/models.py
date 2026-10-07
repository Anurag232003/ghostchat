from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import time

class IdentityProfile(BaseModel):
    # LEVEL 0: Pure Anonymous
    ghost_id: Optional[str] = None

    # LEVEL 1: Nickname + Avatar
    nickname: Optional[str] = None
    avatar_emoji: Optional[str] = "👤"
    avatar_color: Optional[str] = "#6366F1"

    # LEVEL 2: Age + Interests + Vibe
    age: Optional[int] = None
    interests: List[str] = Field(default_factory=list)
    vibe: Optional[str] = None

    # LEVEL 3: First Name
    first_name: Optional[str] = None

    # LEVEL 4: Photo
    photo_url: Optional[str] = None

    # LEVEL 5: Social / Contact Reveal
    socials: Dict[str, str] = Field(default_factory=dict)

    # 17. 📍 Approximate Location Sharing (Opt-in only)
    location_sharing_enabled: bool = False
    approximate_region: Optional[str] = None
    approximate_distance_km: Optional[int] = None

class UserRegisterRequest(BaseModel):
    pseudonym: str = Field(..., min_length=2, max_length=50)
    ed25519_identity_pub: str = Field(..., description="Base64 or Hex Ed25519 identity public key")
    x25519_signed_prekey: str = Field(..., description="Base64 or Hex X25519 signed prekey")
    signed_prekey_sig: str = Field(..., description="Signature of the signed prekey verified by identity key")
    one_time_prekeys: List[str] = Field(default_factory=list, description="Array of ephemeral one-time prekeys")
    profile: Optional[IdentityProfile] = None

class UpdateProfileRequest(BaseModel):
    profile: IdentityProfile

class UnlockLevelRequest(BaseModel):
    target_user_id: str
    target_level: int = Field(..., ge=0, le=5)
    action: str = Field("grant", description="request | grant")

class RevealedProfileResponse(BaseModel):
    user_id: str
    level_unlocked: int = 0
    # Level 0
    ghost_id: str
    # Level 1 (if level >= 1)
    nickname: Optional[str] = None
    avatar_emoji: Optional[str] = None
    avatar_color: Optional[str] = None
    # Level 2 (if level >= 2)
    age: Optional[int] = None
    interests: Optional[List[str]] = None
    vibe: Optional[str] = None
    # 17. 📍 Approximate Location Sharing (Opt-in only)
    location_sharing_enabled: bool = False
    approximate_location: Optional[str] = None
    approximate_region: Optional[str] = None
    approximate_distance_str: Optional[str] = None
    # Level 3 (if level >= 3)
    first_name: Optional[str] = None
    # Level 4 (if level >= 4)
    photo_url: Optional[str] = None
    # Level 5 (if level >= 5)
    socials: Optional[Dict[str, str]] = None

class ProgressiveRevealStatusResponse(BaseModel):
    user_id: str
    peer_id: str
    elapsed_seconds: float
    stage: int  # 0: Mystery Person, 1: Interest #1, 2: Nickname, 3: Avatar, 4: Photo
    stage_name: str
    
    # Stage 0: Mystery Person
    mystery_title: str = "🌑 Mystery Person"
    ghost_id: str
    
    # Stage 1: Interest #1 (at 5 mins)
    interest_1_unlocked: bool = False
    interest_1: Optional[str] = None
    
    # Stage 2: Nickname (at 10 mins)
    nickname_unlocked: bool = False
    nickname: Optional[str] = None
    
    # Stage 3: Avatar (after mutual interest)
    mutual_interest_unlocked: bool = False
    my_interest_declared: bool = False
    peer_interest_declared: bool = False
    avatar_emoji: Optional[str] = None
    avatar_color: Optional[str] = None
    
    # Stage 4: Photo (mutual consent required)
    photo_unlocked: bool = False
    photo_url: Optional[str] = None
    first_name: Optional[str] = None
    photo_consent_status: str = "idle"  # "idle" | "requested_by_me" | "requested_by_peer" | "mutually_revealed" | "declined"
    requester_nickname: Optional[str] = None
    prompt_text: Optional[str] = None
    
    # Additional context unlocked as stages progress
    all_interests: Optional[List[str]] = None
    age: Optional[int] = None
    vibe: Optional[str] = None
    socials: Optional[Dict[str, str]] = None

class ProgressiveRevealDeclareInterestRequest(BaseModel):
    user_id: str
    peer_id: str
    interested: bool = True

class ProgressiveRevealPhotoRequest(BaseModel):
    user_id: str
    peer_id: str

class ProgressiveRevealPhotoConsentRequest(BaseModel):
    user_id: str
    peer_id: str
    consent: bool  # True: [ Reveal ], False: [ Keep Anonymous ]

class ProgressiveRevealFastForwardRequest(BaseModel):
    user_id: str
    peer_id: str
    add_seconds: int = 300  # Jump 5 mins or 10 mins for testing


class PrekeyBundleResponse(BaseModel):
    user_id: str
    pseudonym: str
    ed25519_identity_pub: str
    x25519_signed_prekey: str
    signed_prekey_sig: str
    one_time_prekey: Optional[str] = None

class UserProfileResponse(BaseModel):
    user_id: str
    pseudonym: str
    ed25519_identity_pub: str
    created_at: float
    is_online: bool = False
    last_seen: float
    profile: Optional[IdentityProfile] = None

class EncryptedMessagePacket(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    recipient_id: Optional[str] = None
    group_id: Optional[str] = None
    ciphertext: str = Field(..., description="Encrypted payload (AES-256-GCM or ChaCha20-Poly1305)")
    ratchet_header: Dict[str, Any] = Field(default_factory=dict, description="Ratchet metadata: dh_ratchet_pub, pn, n, etc.")
    iv_or_nonce: str = Field(..., description="Initialization vector / nonce")
    ephemeral_timer: Optional[int] = Field(None, description="Disappearing message countdown in seconds (e.g. 5, 30, 60)")
    no_forward: bool = False
    reply_to_id: Optional[str] = None
    created_at: float = Field(default_factory=time.time)

class MessageSignal(BaseModel):
    signal_type: str = Field(..., description="typing | delivered | read | reaction | edit | delete | burn")
    conversation_id: str
    sender_id: str
    recipient_id: Optional[str] = None
    group_id: Optional[str] = None
    message_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: float = Field(default_factory=time.time)

class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    member_ids: List[str]
    # Each member receives an encrypted packet containing the group's Sender Key
    encrypted_sender_keys: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Map of recipient user_id to encrypted sender key packet"
    )
    encrypted_meta: Optional[str] = None

class GroupResponse(BaseModel):
    group_id: str
    name: str
    created_by: str
    members: List[Dict[str, Any]]
    created_at: float
    encrypted_meta: Optional[str] = None

class AttachmentMetaResponse(BaseModel):
    attachment_id: str
    uploader_id: str
    size_bytes: int
    sha256_checksum: str
    download_url: str
    created_at: float

# 18. 🔥 Anonymous Topic Rooms Models
class TopicRoomMember(BaseModel):
    ephemeral_id: str
    pseudonym: str = Field(..., description="Ephemeral pseudonym (e.g. Nova, Ghost, Pixel, Luna)")
    avatar_icon: str = "👤"
    joined_at: float = Field(default_factory=time.time)
    is_bot: bool = False

class TopicRoomMessageItem(BaseModel):
    message_id: str
    room_id: str
    sender_pseudonym: str  # e.g. "👤 Nova"
    sender_ephemeral_id: str
    ciphertext: str
    plaintext_preview: Optional[str] = None
    created_at: float = Field(default_factory=time.time)

class CreateTopicRoomRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=60)
    topic_category: str = Field(..., description="Gaming | Movies | Coding | Music | Travel | Students | General")
    topic_icon: str = Field("🔥", max_length=8)
    description: Optional[str] = None
    ttl_hours: int = Field(24, ge=1, le=168)

class JoinTopicRoomRequest(BaseModel):
    custom_pseudonym: Optional[str] = None

class SendTopicRoomMessageRequest(BaseModel):
    ephemeral_id: str
    sender_pseudonym: str
    ciphertext: str
    plaintext: Optional[str] = None

# 19. 🧨 Self-Destruct Conversations Models
class SelfDestructPolicyRequest(BaseModel):
    conversation_id: str
    user_id: str
    delete_after_seconds: Optional[int] = Field(
        None,
        description="Delete after interval in seconds: 300 (5 mins), 3600 (1 hour), 86400 (24 hours), 604800 (7 days), or None (Never)"
    )
    retention_label: Optional[str] = Field("Never", description="5 minutes | 1 hour | 24 hours | 7 days | Never")

class SelfDestructPolicyResponse(BaseModel):
    conversation_id: str
    delete_after_seconds: Optional[int] = None
    retention_label: str = "Never"
    updated_at: float = Field(default_factory=time.time)
    updated_by: Optional[str] = None
    e2ee_disclaimer: str = "For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."

class BurnConversationRequest(BaseModel):
    conversation_id: str
    user_id: str

# 20. 🔐 Secret Chat Mode Models
class InitSecretChatRequest(BaseModel):
    user_id: str
    peer_id: str
    ttl_seconds: int = Field(1800, ge=60, le=86400, description="Session expiration in seconds (default 30 mins)")
    disappearing_seconds: int = Field(30, ge=5, le=3600, description="Disappearing message countdown (default 30s)")
    temp_public_key: Optional[str] = Field(None, description="Ephemeral X25519 public key generated solely for this secret session")

class SecretChatSessionResponse(BaseModel):
    secret_session_id: str
    initiator_id: str
    peer_id: str
    disappearing_seconds: int
    ttl_seconds: int
    expires_at: float
    characteristics: Dict[str, Any]
    status: str = "active"
    created_at: float = Field(default_factory=time.time)

class TerminateSecretChatRequest(BaseModel):
    secret_session_id: str
    user_id: str

# 22. 🧬 Anonymous Personality Card Models
class AnonymousPersonalityCard(BaseModel):
    user_id: str
    card_title: str = "MYSTERY PROFILE"
    vibes: List[str] = Field(
        default_factory=lambda: ["☕ Coffee", "🎮 Gaming", "🌌 Night Owl", "🎵 Indie Music"],
        description="User-selected lifestyle and vibe badges"
    )
    conversation_style_val: int = Field(8, ge=1, le=10, description="1 to 10 scale (8/10 -> ████████░░)")
    conversation_style_bar: str = "████████░░"
    conversation_style_label: str = "Deep & Reflective"
    energy_val: int = Field(7, ge=1, le=10, description="1 to 10 scale (7/10 -> ███████░░░)")
    energy_bar: str = "███████░░░"
    energy_label: str = "Warm & Engaging"
    topics: List[str] = Field(
        default_factory=lambda: ["Technology", "Travel", "Movies"],
        description="User-selected topics of interest"
    )
    is_generated_from_preferences: bool = True
    privacy_notice: str = "These can be generated from user-selected preferences rather than secretly profiling them."
    updated_at: float = Field(default_factory=time.time)

class UpdatePersonalityCardRequest(BaseModel):
    vibes: Optional[List[str]] = None
    conversation_style_val: Optional[int] = Field(None, ge=1, le=10)
    conversation_style_label: Optional[str] = None
    energy_val: Optional[int] = Field(None, ge=1, le=10)
    energy_label: Optional[str] = None
    topics: Optional[List[str]] = None

# 23. 🌌 Random Universe Matching Models
class UniverseStarNode(BaseModel):
    star_id: str
    symbol: str = "✦"  # "✦" or "○"
    constellation: str
    spectral_type: str
    coordinates: Dict[str, Any]
    user_id: Optional[str] = None
    pseudonym: str
    vibe_signals: List[str]
    conversation_style_bar: str = "████████░░"
    energy_bar: str = "███████░░░"
    approx_location: str = "📍 ~8 km away"
    frequency_mhz: str = "1420.405 MHz"

class UniverseRadarResponse(BaseModel):
    title: str = "🌌 DISCOVER"
    status: str = "signals_detected"
    total_signals: int
    signals_label: str = "Mystery signals detected"
    stars: List[UniverseStarNode]
    scan_timestamp: float = Field(default_factory=time.time)

class UniverseEnterRequest(BaseModel):
    user_id: str

class UniverseConnectStarRequest(BaseModel):
    user_id: str
    star_id: str

# 24. ⚡ Instant 5-Minute Date Models
class Instant5MinDateRequest(BaseModel):
    user_id: str
    force_demo: bool = True

class Instant5MinDecisionRequest(BaseModel):
    room_id: str
    user_id: str
    decision: str = Field(..., description="'continue' | 'friends' | 'exit' | 'maybe_later'")

class Instant5MinMessageRequest(BaseModel):
    room_id: str
    user_id: str
    text: str

# 25. 🔄 Second Chance Models
class SecondChancePlaceRequest(BaseModel):
    user_id: str
    peer_id: str
    peer_pseudonym: Optional[str] = None
    source: str = "blind_date"  # "blind_date" | "instant_date" | "direct"
    source_room_id: Optional[str] = None

class SecondChanceReopenRequest(BaseModel):
    second_chance_id: str
    user_id: str
    simulate_peer_reopen: bool = False

class SecondChanceArchiveRequest(BaseModel):
    second_chance_id: str
    user_id: str

# 26. 🧠 Smart Matchmaking Models
class SmartMatchmakingPrivacyControls(BaseModel):
    use_age_preference: bool = True
    use_interests: bool = True
    use_conversation_preferences: bool = True
    use_language: bool = True
    use_availability: bool = True
    use_date_mode: bool = True
    use_shared_topics: bool = True
    use_past_interactions: bool = True

class SmartMatchmakingPreferences(BaseModel):
    age_preference: str = "21-30"
    interests: List[str] = Field(default_factory=lambda: ["Coffee", "Gaming", "Indie Music"])
    conversation_preference: str = "Deep talks"
    language: str = "English"
    availability: str = "Right now 🟢"
    date_mode: str = "mystery"
    shared_topics: List[str] = Field(default_factory=lambda: ["Technology", "Travel", "Movies"])
    past_interactions_preference: str = "prefer_fresh_or_positive"

class SmartMatchmakingProfileUpdateRequest(BaseModel):
    user_id: str
    controls: SmartMatchmakingPrivacyControls
    preferences: SmartMatchmakingPreferences

class SmartMatchSearchRequest(BaseModel):
    user_id: str
    limit: int = 5

# 27. 🏆 Blind Date XP Models
class AddXPRequest(BaseModel):
    user_id: str
    action_type: str  # "complete_date" | "play_game" | "answer_question" | "mutual_reveal" | "puzzle_solve"
    custom_xp: Optional[int] = None

class UnlockAchievementRequest(BaseModel):
    user_id: str
    achievement_id: str

# 28. 🔥 Daily Mystery Drop Models
class DailyMysteryMatch(BaseModel):
    drop_id: str
    match_date: str
    peer_id: str
    peer_pseudonym: str
    avatar_symbol: str = "🔥"
    vibe_signature: str
    teaser_summary: str
    compatibility_score: int
    common_topics: List[str]
    approx_location: str
    conversation_style_bar: str = "████████░░"
    energy_bar: str = "███████░░░"
    window_duration_seconds: int = 1800

class DailyMysteryDropStatus(BaseModel):
    user_id: str
    drop_date: str
    title: str = "🔥 DAILY MYSTERY DROP"
    subtitle: str = "Every day: ONE MYSTERY MATCH • Available for 30 minutes"
    headline: str = "Your mystery connection is waiting."
    status: str = "ready"  # "ready" | "active" | "connected" | "passed" | "expired"
    match: Optional[DailyMysteryMatch] = None
    opened_at: Optional[float] = None
    time_remaining_seconds: int = 1800
    next_drop_countdown_seconds: int = 43200
    is_claimed_today: bool = False
    purpose_note: str = "This gives users a reason to return."

class OpenDailyDropRequest(BaseModel):
    user_id: str

class ConnectDailyDropRequest(BaseModel):
    user_id: str
    drop_id: str

class PassDailyDropRequest(BaseModel):
    user_id: str
    drop_id: str

# 29. 🕰️ Scheduled Blind Date Models
class ScheduledDateSlot(BaseModel):
    slot_id: str
    day_label: str  # "Tonight" | "Tomorrow"
    time_label: str  # "9:00 PM", "10:00 PM", etc.
    available_peers_count: int = 14
    is_recommended: bool = False

class ScheduledDateEvent(BaseModel):
    booking_id: str
    user_id: str
    peer_id: Optional[str] = None
    peer_pseudonym: str = "Waiting for partner..."
    peer_avatar: str = "🌙"
    peer_vibe: str = "Slot reserved. Waiting for another real user."
    scheduled_day: str = "Tonight"
    scheduled_time: str = "9:00 PM"
    target_timestamp: float
    status: str = "scheduled"  # "scheduled" | "countdown_active" | "live" | "completed" | "cancelled"
    countdown_seconds: int = 261  # 261s -> 00:04:21
    countdown_display: str = "00:04:21"
    room_id: str
    headline: str = "Your date begins in:"
    purpose_note: str = "This creates an actual event rather than an ordinary chat."
    created_at: float = Field(default_factory=time.time)

class BookScheduledDateRequest(BaseModel):
    user_id: str
    scheduled_day: str = "Tonight"
    scheduled_time: str = "9:00 PM"
    demo_countdown_seconds: Optional[int] = None

class CancelScheduledDateRequest(BaseModel):
    booking_id: str
    user_id: str

class EnterScheduledDateRequest(BaseModel):
    booking_id: str
    user_id: str

class TestCountdownRequest(BaseModel):
    booking_id: str
    countdown_seconds: int = 261

# 30. 💎 Date Memory Models
class DateMemory(BaseModel):
    memory_id: str
    user_id: str
    peer_id: str
    peer_pseudonym: str = "🌙 Nova"
    peer_avatar: str = "🌙"
    topics: List[str] = Field(default_factory=lambda: ["Gaming", "Travel", "Music"])
    games_count: int = 3
    date_duration_str: str = "18 min"
    date_duration_minutes: int = 18
    mutual_reveal: bool = True
    mutual_reveal_icon: str = "✓"
    encrypted_notes: Optional[str] = None
    date_timestamp: float = Field(default_factory=time.time)
    created_at: float = Field(default_factory=time.time)
    is_private_encrypted: bool = True
    tagline: str = "This becomes a private encrypted 'date memory.'"

class CreateDateMemoryRequest(BaseModel):
    user_id: str
    peer_id: str
    peer_pseudonym: str = "🌙 Nova"
    topics: List[str] = Field(default_factory=lambda: ["Gaming", "Travel", "Music"])
    games_count: int = 3
    date_duration_minutes: int = 18
    mutual_reveal: bool = True
    encrypted_notes: Optional[str] = None

class UpdateDateMemoryNotesRequest(BaseModel):
    user_id: str
    memory_id: str
    encrypted_notes: str

# 🏗️ Recommended Technical Architecture & Database Structure Models
class DBUser(BaseModel):
    id: str
    username: str
    public_key: str
    avatar: str = "👤"
    age_range: Optional[str] = "21-30"
    interests: List[str] = Field(default_factory=lambda: ["Gaming", "Travel", "Music"])
    created_at: float = Field(default_factory=time.time)

class DBConversation(BaseModel):
    id: str
    type: str = "direct"  # "direct" | "blind_date" | "group" | "secret"
    created_at: float = Field(default_factory=time.time)
    expires_at: Optional[float] = None

class DBMessage(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    encrypted_payload: str
    nonce: str
    timestamp: float = Field(default_factory=time.time)
    expires_at: Optional[float] = None

class DBBlindDate(BaseModel):
    id: str
    user_a: str
    user_b: str
    status: str = "matched"  # "queued" | "matched" | "active" | "ended"
    mode: str = "15-Min Mystery Date"  # "5-Min Quick Date" | "15-Min Mystery Date" | "Voice Date" | "Game Date"
    started_at: float = Field(default_factory=time.time)
    expires_at: float
    reveal_level: int = 0

class DBBlindDateAnswer(BaseModel):
    date_id: str
    question_id: str
    encrypted_answer: str

class DBMatchQueue(BaseModel):
    user_id: str
    preferences: Dict[str, Any] = Field(default_factory=dict)
    interests: List[str] = Field(default_factory=list)
    availability: str = "Right now 🟢"
    mode: str = "15-Min Mystery Date"
    joined_at: float = Field(default_factory=time.time)





