"""
Security utilities used across engines:
- Rate limiting (slowapi)
- File magic-bytes validation (defense-in-depth vs extension spoofing)
"""
import filetype
from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_client_ip(request: Request) -> str:
    """
    Return the true client IP, honouring Emergent's proxy chain.
    Fallback to slowapi's default remote_address if headers absent.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return get_remote_address(request)


# Global limiter instance — engines import and reuse this
limiter = Limiter(key_func=_get_client_ip, default_limits=["300/minute"])


# ==================== FILE MAGIC-BYTES VALIDATION ====================
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v"}


def validate_image_bytes(data: bytes, label: str = "الصورة") -> str:
    """Verify actual bytes are a supported image. Returns the detected MIME."""
    kind = filetype.guess(data)
    if kind is None or kind.mime not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(400, f"صيغة {label} غير مدعومة (يجب أن تكون JPG / PNG / WEBP)")
    return kind.mime


def validate_video_bytes(data: bytes, label: str = "الفيديو") -> str:
    """Verify actual bytes are a supported video. Returns the detected MIME."""
    kind = filetype.guess(data)
    if kind is None or kind.mime not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(400, f"صيغة {label} غير مدعومة (يجب أن تكون MP4 / MOV / WEBM)")
    return kind.mime


def validate_media_bytes(data: bytes) -> tuple[str, str]:
    """
    For messenger attachments — image OR video OR generic file.
    Returns (mime, media_type) where media_type ∈ {image, video, file}.
    """
    kind = filetype.guess(data)
    if kind and kind.mime in ALLOWED_IMAGE_MIMES:
        return kind.mime, "image"
    if kind and kind.mime in ALLOWED_VIDEO_MIMES:
        return kind.mime, "video"
    # generic file — reject clearly-dangerous executables via magic
    dangerous = {"application/x-msdownload", "application/x-executable", "application/x-sh"}
    if kind and kind.mime in dangerous:
        raise HTTPException(400, "نوع الملف غير مسموح لأسباب أمنية")
    return (kind.mime if kind else "application/octet-stream"), "file"
