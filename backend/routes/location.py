import re
import random
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from ..database import get_db
from ..websocket_manager import ws_manager

logger = logging.getLogger("e2ee.location")

router = APIRouter(prefix="/api/location", tags=["Approximate Location Privacy"])

# Coarse Metropolitan / Regional Buckets (Never exact addresses!)
COARSE_REGIONS = [
    "Delhi NCR",
    "South Mumbai",
    "Bengaluru Central",
    "Hyderabad Metro",
    "Pune West",
    "Kolkata Metropolitan",
    "Chennai Central",
    "Greater London",
    "NYC Metro",
    "SF Bay Area"
]

# Strict prohibition against exact addresses (e.g. "123 Main Street", GPS coords)
EXACT_ADDRESS_REGEX = re.compile(
    r'(\b\d{1,5}\s+[A-Za-z0-9.-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct)\b|'
    r'[-+]?([1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*[-+]?(180(?:\.0+)?|((1[0-7]\d)|([1-9]?\d))(?:\.\d+)?))',
    re.IGNORECASE
)

PRIVACY_GUARANTEE_STATEMENT = (
    "Never show: 123 Main Street. "
    "Instead: 📍 ~8 km away or 📍 Delhi NCR. "
    "Only if the user explicitly enables location sharing."
)


def format_approximate_distance(km: int) -> str:
    """
    Fuzzes and rounds distance to a protected approximation bucket.
    Never exposes exact meters or fine-grained decimals.
    e.g. "📍 ~8 km away"
    """
    if km <= 2:
        return "📍 < 2 km away"
    return f"📍 ~{km} km away"


def validate_coarse_location(text: Optional[str]) -> str:
    """
    Enforces that locations are approximate regions (e.g. 'Delhi NCR')
    and NEVER exact addresses (like '123 Main Street' or GPS coordinates).
    """
    if not text:
        return "Delhi NCR"

    cleaned = text.strip()
    if EXACT_ADDRESS_REGEX.search(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Exact addresses (e.g. '123 Main Street' or exact coordinates) are prohibited. You may only share coarse approximate regions (e.g. 'Delhi NCR')."
        )

    return cleaned


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class ToggleLocationSharingRequest(BaseModel):
    user_id: str
    enabled: bool = Field(..., description="Explicit opt-in to approximate location sharing")
    region: Optional[str] = Field("Delhi NCR", description="Coarse approximate metro region (e.g. Delhi NCR)")
    fuzzed_distance_km: Optional[int] = Field(8, ge=1, le=100, description="Approximate distance bucket")

class ApproximateLocationResponse(BaseModel):
    user_id: str
    location_sharing_enabled: bool
    approximate_distance: Optional[str] = None  # e.g. "📍 ~8 km away"
    approximate_region: Optional[str] = None    # e.g. "📍 Delhi NCR"
    display: Optional[str] = None
    privacy_notice: str
    exact_address_forbidden: bool = True


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/regions")
async def get_coarse_regions():
    """
    Returns curated coarse regions and approximate location privacy principles.
    """
    return {
        "coarse_regions": COARSE_REGIONS,
        "default_region": "Delhi NCR",
        "sample_distance_approximation": "📍 ~8 km away",
        "sample_region_approximation": "📍 Delhi NCR",
        "privacy_rule": PRIVACY_GUARANTEE_STATEMENT
    }


@router.get("/status", response_model=ApproximateLocationResponse)
async def get_location_status(user_id: str = Query(...), peer_id: Optional[str] = Query(None)):
    """
    Returns approximate location for user or peer.
    STRICT CONSTRAINT: Only shown if the user explicitly enabled location sharing.
    Never shows exact addresses like 123 Main Street.
    """
    db = get_db()
    target_id = peer_id if peer_id else user_id
    target_doc = None

    if db is not None:
        target_doc = await db.users.find_one({"user_id": target_id})

    profile = (target_doc or {}).get("profile", {})
    enabled = profile.get("location_sharing_enabled", False)

    if not enabled:
        return ApproximateLocationResponse(
            user_id=target_id,
            location_sharing_enabled=False,
            approximate_distance=None,
            approximate_region=None,
            display="📍 Location Hidden",
            privacy_notice="Location is only shared if the user explicitly enables location sharing.",
            exact_address_forbidden=True
        )

    # Opted-in: Return fuzzy approximate location
    region = profile.get("approximate_region") or "Delhi NCR"
    dist_km = profile.get("approximate_distance_km", 8)
    approx_dist = format_approximate_distance(dist_km)
    approx_reg = f"📍 {region}"

    return ApproximateLocationResponse(
        user_id=target_id,
        location_sharing_enabled=True,
        approximate_distance=approx_dist,
        approximate_region=approx_reg,
        display=f"{approx_dist} • {region}",
        privacy_notice=PRIVACY_GUARANTEE_STATEMENT,
        exact_address_forbidden=True
    )


@router.post("/toggle")
async def toggle_location_sharing(req: ToggleLocationSharingRequest):
    """
    Explicitly enables or disables approximate location sharing.
    Validates that exact street addresses (e.g. 123 Main Street) are rejected.
    """
    db = get_db()
    coarse_region = validate_coarse_location(req.region)
    dist_km = req.fuzzed_distance_km or 8

    if db is not None:
        await db.users.update_one(
            {"user_id": req.user_id},
            {"$set": {
                "profile.location_sharing_enabled": req.enabled,
                "profile.approximate_region": coarse_region,
                "profile.approximate_distance_km": dist_km
            }}
        )

    approx_dist = format_approximate_distance(dist_km) if req.enabled else None
    approx_reg = f"📍 {coarse_region}" if req.enabled else None

    return {
        "status": "success",
        "user_id": req.user_id,
        "location_sharing_enabled": req.enabled,
        "approximate_distance": approx_dist,
        "approximate_region": approx_reg,
        "display": f"{approx_dist} • {coarse_region}" if req.enabled else "📍 Location Hidden",
        "privacy_rule": PRIVACY_GUARANTEE_STATEMENT
    }


@router.post("/calculate-peer-distance")
async def calculate_peer_distance(
    user_id: str = Query(...),
    peer_id: str = Query(...),
    peer_region: Optional[str] = Query("Delhi NCR"),
    simulated_km: int = Query(8)
):
    """
    Computes approximate distance between two peers.
    Enforces opt-in constraint: If user has not enabled location sharing,
    distance is concealed.
    """
    db = get_db()
    user_doc = await db.users.find_one({"user_id": user_id}) if db is not None else None
    user_profile = (user_doc or {}).get("profile", {})
    user_enabled = user_profile.get("location_sharing_enabled", False)

    peer_doc = await db.users.find_one({"user_id": peer_id}) if db is not None else None
    peer_profile = (peer_doc or {}).get("profile", {})
    peer_enabled = peer_profile.get("location_sharing_enabled", False)

    # Only show if the peer (or mutual user) explicitly enables location sharing
    if not peer_enabled and not user_enabled:
        return {
            "is_shared": False,
            "display": "📍 Location Hidden",
            "reason": "Only shown if the user explicitly enables location sharing.",
            "privacy_guarantee": PRIVACY_GUARANTEE_STATEMENT
        }

    # Obfuscated / Fuzzed Distance
    coarse_region = peer_profile.get("approximate_region") or peer_region or "Delhi NCR"
    # Never show exact addresses
    validate_coarse_location(coarse_region)

    dist_km = peer_profile.get("approximate_distance_km", simulated_km)
    approx_dist = format_approximate_distance(dist_km)

    return {
        "is_shared": True,
        "approximate_distance": approx_dist,       # e.g. "📍 ~8 km away"
        "approximate_region": f"📍 {coarse_region}", # e.g. "📍 Delhi NCR"
        "display": f"{approx_dist} ({coarse_region})",
        "never_show": "123 Main Street",
        "privacy_guarantee": PRIVACY_GUARANTEE_STATEMENT
    }
