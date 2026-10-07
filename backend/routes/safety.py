import re
import time
import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from ..database import get_db
from ..websocket_manager import ws_manager

logger = logging.getLogger("e2ee.safety")

router = APIRouter(prefix="/api/safety", tags=["Safety & Contact Protection"])

# The 6 strictly defined report categories
REPORT_CATEGORIES = [
    "Harassment",
    "Spam",
    "Impersonation",
    "Threatening behaviour",
    "Unwanted content",
    "Other"
]

# Transparency disclaimer for screenshot warning
SCREENSHOT_DISCLAIMER = (
    "Screenshot detection is attempted on supported platforms, but screenshots "
    "cannot always be prevented due to OS and hardware constraints. Mutual trust, "
    "pseudonymity, and mindful sharing remain your essential protection."
)

# ============================================================================
# CONTACT PROTECTION PATTERNS
# Don't expose: phone number, email, exact location, device information
# ============================================================================

# 1. Phone number patterns (international, US, spaced, dashes, parentheses)
PHONE_PATTERNS = [
    re.compile(r'(?:\+|00)[1-9]\d{0,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}', re.VERBOSE),
    re.compile(r'\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
    re.compile(r'\b[6-9]\d{9}\b'),  # Common 10-digit mobile sequence
    re.compile(r'\b\d{5}[-.\s]\d{5}\b'),
    re.compile(r'(?:call|text|phone|ph|tel|whatsapp|cell|mobile)\s*(?:me\s*at|:)?\s*[\d\s\-\+\(\).]{7,15}', re.IGNORECASE)
]

# 2. Email pattern (standard and obfuscated "user at domain dot com")
EMAIL_PATTERNS = [
    re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', re.IGNORECASE),
    re.compile(r'\b[a-zA-Z0-9_.+-]+\s*(?:\[at\]|@|\bat\b)\s*[a-zA-Z0-9-]+\s*(?:\[dot\]|\.|\bdot\b)\s*[a-zA-Z]{2,}\b', re.IGNORECASE)
]

# 3. Exact location patterns (GPS coordinates, lat/lon pairs, DMS, street addresses)
LOCATION_PATTERNS = [
    re.compile(r'[-+]?([1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*[-+]?(180(?:\.0+)?|((1[0-7]\d)|([1-9]?\d))(?:\.\d+)?)'),
    re.compile(r'\b(?:lat(?:itude)?\s*[:=]\s*[-+]?\d+\.\d+.*?lon(?:gitude)?\s*[:=]\s*[-+]?\d+\.\d+)', re.IGNORECASE),
    re.compile(r'\b\d{1,2}°\s*\d{1,2}[\'′]?\s*(?:[0-9.]+[\"″]?\s*)?[NSEW]\b', re.IGNORECASE),
    re.compile(r'\b\d{1,5}\s+(?:[A-Za-z0-9.-]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir)\b', re.IGNORECASE)
]

# 4. Device information patterns (User-Agent, IMEI, MAC address, Hardware models, OS versions)
DEVICE_PATTERNS = [
    re.compile(r'\b(?:Mozilla\/5\.0|AppleWebKit|Gecko|CFNetwork|Dalvik\/|Darwin Kernel)\b', re.IGNORECASE),
    re.compile(r'\b(?:iPhone\s*(?:1[1-6]|X|XS|XR|SE|12|13|14|15|16)|iPad\s*Pro|Pixel\s*[6-9]|Galaxy\s*S2[0-4]|OnePlus\s*\d+)\b', re.IGNORECASE),
    re.compile(r'\b(?:iOS\s*\d+\.\d+|Android\s*(?:1[0-5]|\d+\.\d+)|Windows\s*NT\s*\d+\.\d+|macOS\s*\d+\.\d+)\b', re.IGNORECASE),
    re.compile(r'\b(?:MAC:\s*|MAC Address:\s*)?([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b', re.IGNORECASE),
    re.compile(r'\b(?:IMEI:\s*|IMEI\s*#?\s*)?\d{15}\b', re.IGNORECASE),
    re.compile(r'\b(?:User-Agent:\s*|Device:\s*|OS Version:\s*)[^\n]{4,50}', re.IGNORECASE)
]


def sanitize_contact_leaks(text: str) -> Dict[str, Any]:
    """
    Scans text for prohibited leaks:
    - Phone number
    - Email
    - Exact location
    - Device information
    Returns sanitized text and detected categories.
    """
    if not text:
        return {
            "is_safe": True,
            "sanitized_text": "",
            "detected_leaks": [],
            "warning": None
        }

    detected_leaks = []
    sanitized = text

    # Check and mask Phone Numbers
    for pat in PHONE_PATTERNS:
        matches = pat.findall(sanitized)
        if matches:
            if "phone_number" not in detected_leaks:
                detected_leaks.append("phone_number")
            sanitized = pat.sub("[🛡️ Protected: Phone Number]", sanitized)

    # Check and mask Emails
    for pat in EMAIL_PATTERNS:
        matches = pat.findall(sanitized)
        if matches:
            if "email" not in detected_leaks:
                detected_leaks.append("email")
            sanitized = pat.sub("[🛡️ Protected: Email]", sanitized)

    # Check and mask Locations
    for pat in LOCATION_PATTERNS:
        matches = pat.findall(sanitized)
        if matches:
            if "exact_location" not in detected_leaks:
                detected_leaks.append("exact_location")
            sanitized = pat.sub("[🛡️ Protected: Exact Location]", sanitized)

    # Check and mask Device info
    for pat in DEVICE_PATTERNS:
        matches = pat.findall(sanitized)
        if matches:
            if "device_information" not in detected_leaks:
                detected_leaks.append("device_information")
            sanitized = pat.sub("[🛡️ Protected: Device Info]", sanitized)

    is_safe = len(detected_leaks) == 0
    warning = None
    if not is_safe:
        readable_leaks = ", ".join(k.replace("_", " ") for k in detected_leaks)
        warning = (
            f"🛡️ Contact Protection Notice: Direct sharing of {readable_leaks} is restricted "
            "during Blind Date to preserve mutual anonymity and prevent unsolicited contact."
        )

    return {
        "is_safe": is_safe,
        "sanitized_text": sanitized,
        "detected_leaks": detected_leaks,
        "warning": warning
    }


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class InstantBlockRequest(BaseModel):
    user_id: str = Field(..., description="User performing the instant block")
    target_user_id: str = Field(..., description="User to be blocked immediately")
    room_id: Optional[str] = Field(None, description="Active blind date chamber ID if applicable")
    reason: Optional[str] = Field("Instant one-tap block", description="Reason note")

class ReportRequest(BaseModel):
    reporter_id: str = Field(..., description="User filing the report")
    target_user_id: str = Field(..., description="User being reported")
    category: str = Field(..., description="One of: Harassment, Spam, Impersonation, Threatening behaviour, Unwanted content, Other")
    details: Optional[str] = Field(None, description="Optional description or context")
    room_id: Optional[str] = Field(None, description="Active blind date chamber ID if applicable")
    auto_block: bool = Field(True, description="Automatically block peer upon reporting")

class ScreenshotWarningRequest(BaseModel):
    user_id: str = Field(..., description="User on whose client screenshot activity was detected")
    peer_id: Optional[str] = Field(None, description="Partner user ID to notify")
    room_id: Optional[str] = Field(None, description="Blind date room ID")
    platform: Optional[str] = Field("web", description="Client platform (web, android, ios)")

class ContentCheckRequest(BaseModel):
    text: str = Field(..., description="Content to inspect for contact leaks")

class UnblockRequest(BaseModel):
    user_id: str
    target_user_id: str


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/report-categories")
async def get_report_categories():
    """
    Returns the 6 official safety report categories.
    """
    return {
        "categories": REPORT_CATEGORIES,
        "total": len(REPORT_CATEGORIES)
    }


@router.get("/screenshot-policy")
async def get_screenshot_policy():
    """
    Returns the transparent screenshot policy.
    We attempt screenshot detection on supported platforms, but do not claim
    screenshots can always be prevented.
    """
    return {
        "detection_supported_platforms": ["web_keyup", "android_window_flags", "ios_screenshot_notification"],
        "transparency_notice": SCREENSHOT_DISCLAIMER,
        "prevention_guarantee": "Screenshots cannot always be prevented by any software.",
        "best_practice": "Mutual anonymity, pseudonyms, and unrevealed photos provide primary safety."
    }


@router.post("/instant-block")
async def instant_block(req: InstantBlockRequest):
    """
    One-Tap Instant Block:
    Immediately severs connection, terminates active blind date chamber,
    and records persistent block.
    """
    db = get_db()
    now = time.time()

    # 1. Record block in database
    if db is not None:
        await db.user_blocks.update_one(
            {"blocker_id": req.user_id, "blocked_id": req.target_user_id},
            {"$set": {
                "blocker_id": req.user_id,
                "blocked_id": req.target_user_id,
                "instant": True,
                "reason": req.reason or "Instant one-tap block",
                "created_at": now
            }},
            upsert=True
        )

    # 2. Terminate Blind Date room if room_id provided
    if req.room_id:
        from .blind_date import active_rooms
        room = active_rooms.get(req.room_id)
        if room:
            room["status"] = "blocked"
            room["blocked_by"] = req.user_id
            active_rooms[req.room_id] = room

        if db is not None:
            await db.blind_date_rooms.update_one(
                {"room_id": req.room_id},
                {"$set": {
                    "status": "blocked",
                    "blocked_by": req.user_id,
                    "ended_at": now
                }}
            )

    # 3. Notify peer neutrally
    await ws_manager.send_to_user(req.target_user_id, {
        "type": "signal",
        "signal": {
            "signal_type": "blind_date.ended_safely",
            "room_id": req.room_id,
            "message": "The Blind Date has ended.",
            "timestamp": now
        }
    })

    return {
        "status": "blocked",
        "blocker_id": req.user_id,
        "blocked_id": req.target_user_id,
        "room_id": req.room_id,
        "message": "User blocked instantly with one tap. Communications severed.",
        "timestamp": now
    }


@router.post("/report")
async def submit_safety_report(req: ReportRequest):
    """
    Submits a safety report categorized under:
    - Harassment
    - Spam
    - Impersonation
    - Threatening behaviour
    - Unwanted content
    - Other

    Optionally executes auto-block immediately.
    """
    if req.category not in REPORT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report category. Must be one of: {', '.join(REPORT_CATEGORIES)}"
        )

    db = get_db()
    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    now = time.time()

    report_doc = {
        "report_id": report_id,
        "reporter_id": req.reporter_id,
        "target_user_id": req.target_user_id,
        "category": req.category,
        "details": req.details or "",
        "room_id": req.room_id,
        "status": "received",
        "created_at": now
    }

    if db is not None:
        await db.safety_reports.insert_one(dict(report_doc))

    # Auto-block if requested (default True)
    if req.auto_block:
        if db is not None:
            await db.user_blocks.update_one(
                {"blocker_id": req.reporter_id, "blocked_id": req.target_user_id},
                {"$set": {
                    "blocker_id": req.reporter_id,
                    "blocked_id": req.target_user_id,
                    "report_id": report_id,
                    "category": req.category,
                    "created_at": now
                }},
                upsert=True
            )

        if req.room_id:
            from .blind_date import active_rooms
            room = active_rooms.get(req.room_id)
            if room:
                room["status"] = "blocked"
                active_rooms[req.room_id] = room
            if db is not None:
                await db.blind_date_rooms.update_one(
                    {"room_id": req.room_id},
                    {"$set": {"status": "blocked", "reported": True, "ended_at": now}}
                )

        # Notify reported user neutrally
        await ws_manager.send_to_user(req.target_user_id, {
            "type": "signal",
            "signal": {
                "signal_type": "blind_date.ended_safely",
                "room_id": req.room_id,
                "message": "The Blind Date has ended.",
                "timestamp": now
            }
        })

    return {
        "status": "report_received",
        "report_id": report_id,
        "category": req.category,
        "auto_blocked": req.auto_block,
        "message": "Report logged securely. Peer has been disconnected and blocked.",
        "timestamp": now
    }


@router.post("/screenshot-warning")
async def report_screenshot_activity(req: ScreenshotWarningRequest):
    """
    Logs screenshot event and notifies room participants.
    Reinforces transparency: Screenshots cannot always be prevented.
    """
    db = get_db()
    now = time.time()
    event_id = f"ss_{uuid.uuid4().hex[:8]}"

    if db is not None:
        await db.safety_audit.insert_one({
            "event_id": event_id,
            "type": "screenshot_activity",
            "user_id": req.user_id,
            "peer_id": req.peer_id,
            "room_id": req.room_id,
            "platform": req.platform,
            "timestamp": now
        })

    # Notify peer if connected
    if req.peer_id:
        await ws_manager.send_to_user(req.peer_id, {
            "type": "signal",
            "signal": {
                "signal_type": "safety.screenshot_warning",
                "room_id": req.room_id,
                "message": "⚠️ Potential screenshot activity detected from your date partner.",
                "notice": SCREENSHOT_DISCLAIMER,
                "timestamp": now
            }
        })

    return {
        "status": "screenshot_warning_recorded",
        "event_id": event_id,
        "transparency_notice": SCREENSHOT_DISCLAIMER,
        "timestamp": now
    }


@router.post("/check-content")
async def check_contact_leaks(req: ContentCheckRequest):
    """
    Audits message content for prohibited contact leaks:
    - Phone number
    - Email
    - Exact location
    - Device information
    """
    result = sanitize_contact_leaks(req.text)
    return result


@router.get("/blocked-list")
async def get_blocked_users(user_id: str = Query(...)):
    """
    Returns list of user IDs blocked by user_id.
    """
    db = get_db()
    if db is None:
        return {"blocked_ids": []}

    cursor = db.user_blocks.find({"blocker_id": user_id})
    records = await cursor.to_list(length=500)
    blocked_ids = [r["blocked_id"] for r in records]
    return {
        "user_id": user_id,
        "blocked_ids": blocked_ids,
        "total": len(blocked_ids)
    }


@router.post("/unblock")
async def unblock_user(req: UnblockRequest):
    """
    Removes user from block list.
    """
    db = get_db()
    if db is not None:
        await db.user_blocks.delete_one({
            "blocker_id": req.user_id,
            "blocked_id": req.target_user_id
        })
    return {
        "status": "unblocked",
        "user_id": req.user_id,
        "target_user_id": req.target_user_id
    }
