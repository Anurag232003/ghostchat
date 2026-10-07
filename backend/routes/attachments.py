import uuid
import time
import hashlib
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse
from ..database import get_db
from ..config import MEDIA_DIR
from ..models import AttachmentMetaResponse

router = APIRouter(prefix="/api/attachments", tags=["Encrypted Attachments & Voice Notes"])

@router.post("/upload")
async def upload_encrypted_attachment(file: UploadFile = File(...), uploader_id: str = ""):
    db = get_db()
    attachment_id = f"att_{uuid.uuid4().hex[:16]}"
    file_path = MEDIA_DIR / f"{attachment_id}.enc"

    hasher = hashlib.sha256()
    size_bytes = 0

    with open(file_path, "wb") as f:
        while chunk := await file.read(64 * 1024):
            hasher.update(chunk)
            size_bytes += len(chunk)
            f.write(chunk)

    checksum = hasher.hexdigest()
    now = time.time()

    doc = {
        "attachment_id": attachment_id,
        "uploader_id": uploader_id,
        "size_bytes": size_bytes,
        "sha256_checksum": checksum,
        "created_at": now,
        "storage_path": str(file_path)
    }

    if db is not None:
        await db.attachments.insert_one(doc)

    return AttachmentMetaResponse(
        attachment_id=attachment_id,
        uploader_id=uploader_id,
        size_bytes=size_bytes,
        sha256_checksum=checksum,
        download_url=f"/api/attachments/download/{attachment_id}",
        created_at=now
    )

@router.get("/download/{attachment_id}")
async def download_encrypted_attachment(attachment_id: str):
    file_path = MEDIA_DIR / f"{attachment_id}.enc"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Encrypted attachment blob not found")

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=f"{attachment_id}.enc"
    )

@router.post("/upload-media")
async def upload_chat_media(file: UploadFile = File(...), uploader_id: str = ""):
    """
    Uploads a photo or video for chat messaging (supports both Normal View and One-Time View).
    """
    content_type = file.content_type or "application/octet-stream"
    is_video = content_type.startswith("video")
    file_type = "video" if is_video else "image"

    # Derive extension
    orig_name = file.filename or ("video.mp4" if is_video else "image.jpg")
    ext = Path(orig_name).suffix.lower()
    if not ext:
        ext = ".mp4" if is_video else ".jpg"

    media_id = f"media_{uuid.uuid4().hex[:14]}"
    filename = f"{media_id}{ext}"
    file_path = MEDIA_DIR / filename

    size_bytes = 0
    hasher = hashlib.sha256()

    with open(file_path, "wb") as f:
        while chunk := await file.read(64 * 1024):
            hasher.update(chunk)
            size_bytes += len(chunk)
            f.write(chunk)

    db = get_db()
    if db is not None:
        await db.attachments.insert_one({
            "attachment_id": media_id,
            "filename": filename,
            "uploader_id": uploader_id,
            "file_type": file_type,
            "mime_type": content_type,
            "size_bytes": size_bytes,
            "sha256": hasher.hexdigest(),
            "created_at": time.time()
        })

    return {
        "status": "success",
        "media_id": media_id,
        "url": f"/api/attachments/media/{media_id}",
        "file_type": file_type,
        "mime_type": content_type,
        "name": orig_name,
        "size_bytes": size_bytes,
        "size_formatted": f"{(size_bytes / (1024 * 1024)):.2f} MB" if size_bytes > 1024 * 1024 else f"{(size_bytes / 1024):.1f} KB"
    }

@router.post("/upload-avatar")
async def upload_profile_avatar(file: UploadFile = File(...), user_id: str = ""):
    """
    Uploads an avatar photo for a user's identity profile.
    """
    content_type = file.content_type or "image/jpeg"
    orig_name = file.filename or "avatar.jpg"
    ext = Path(orig_name).suffix.lower() or ".jpg"

    avatar_id = f"avatar_{uuid.uuid4().hex[:12]}"
    filename = f"{avatar_id}{ext}"
    file_path = MEDIA_DIR / filename

    size_bytes = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(64 * 1024):
            size_bytes += len(chunk)
            f.write(chunk)

    photo_url = f"/api/attachments/media/{avatar_id}"

    db = get_db()
    if db is not None and user_id:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"profile.photo_url": photo_url}}
        )

    return {
        "status": "success",
        "photo_url": photo_url,
        "avatar_id": avatar_id,
        "filename": filename,
        "size_bytes": size_bytes
    }

@router.get("/media/{media_id}")
async def serve_media(media_id: str):
    """
    Serves stored chat photo, video, or profile avatar with proper MIME headers.
    """
    # Look for file matching media_id prefix
    matched = list(MEDIA_DIR.glob(f"{media_id}*"))
    if not matched:
        raise HTTPException(status_code=404, detail="Media file not found")

    target_path = matched[0]
    ext = target_path.suffix.lower()

    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".m4v": "video/mp4"
    }
    media_type = mime_map.get(ext, "application/octet-stream")

    return FileResponse(
        path=target_path,
        media_type=media_type,
        filename=target_path.name
    )
