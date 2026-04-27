import json
from pathlib import Path
from urllib.parse import urlencode

from workers import Blob, fetch


async def list_blobs(settings):
    query = urlencode({"limit": "1000", "prefix": settings.BLOB_PREFIX})
    resp = await fetch(
        f"https://vercel.com/api/blob?{query}",
        method="GET",
        headers={"authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}"},
    )

    if resp.status != 200:
        try:
            details = await resp.json()
        except Exception:
            details = await resp.text()
        raise RuntimeError(f"Blob API request failed (status {resp.status}): {details}")

    result = await resp.json()
    blobs_list = result.get("blobs", [])

    groups = {}
    for blob in blobs_list:
        pathname = blob.get("pathname", "")
        url = blob.get("url")
        uploaded_at = blob.get("uploadedAt")

        p = Path(pathname)
        parent_dir = str(p.parent)
        filename = p.name

        if parent_dir not in groups:
            groups[parent_dir] = {
                "path": parent_dir,
                "timestamp": uploaded_at,
                "txt_url": None,
                "md_url": None,
            }

        if uploaded_at and (
            not groups[parent_dir]["timestamp"]
            or uploaded_at > groups[parent_dir]["timestamp"]
        ):
            groups[parent_dir]["timestamp"] = uploaded_at

        if filename.endswith(".md"):
            groups[parent_dir]["md_url"] = url
        elif filename.endswith(".txt"):
            groups[parent_dir]["txt_url"] = url

    return [groups[k] for k in sorted(groups.keys())]


def _sanitize_filename(filename: str) -> str:
    base = Path(filename).name
    cleaned = []
    last_was_sep = False
    for char in base:
        if char.isalnum() or char in {".", "_", "-"}:
            cleaned.append(char)
            last_was_sep = False
        else:
            if not last_was_sep:
                cleaned.append("_")
                last_was_sep = True
    sanitized = "".join(cleaned).strip("._")
    return sanitized or "file"


def build_blob_pathname(settings, blob_path: str, filename: str) -> str:
    prefix = settings.BLOB_PREFIX.rstrip("/")
    clean_blob_path = (blob_path or "").strip("/")
    sanitized_filename = _sanitize_filename(filename)

    if sanitized_filename.lower().endswith((".md", ".markdown")):
        leaf_name = sanitized_filename
    else:
        leaf_name = f"{sanitized_filename}.txt"

    parts = [prefix]
    if clean_blob_path:
        parts.append(clean_blob_path)
    parts.append(leaf_name)
    return "/".join(parts)


async def upload_blob(settings, pathname: str, file_bytes: bytes, content_type: str | None, allow_overwrite: bool = False):
    headers = {
        "authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}",
        "x-vercel-blob-access": "public",
    }
    if content_type:
        headers["x-content-type"] = content_type
        headers["content-type"] = content_type
    if allow_overwrite:
        headers["x-allow-overwrite"] = "1"
    body = Blob(file_bytes, content_type=content_type).js_object
    resp = await fetch(
        f"https://vercel.com/api/blob/?pathname={pathname}",
        method="PUT",
        headers=headers,
        body=body,
    )

    if resp.status not in (200, 201):
        try:
            details = await resp.json()
        except Exception:
            details = await resp.text()
        raise RuntimeError(f"Blob upload failed (status {resp.status}): {details}")

    return await resp.json()


async def delete_blob(settings, urls: list[str]):
    resp = await fetch(
        "https://vercel.com/api/blob/delete",
        method="POST",
        headers={
            "authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}",
            "content-type": "application/json",
        },
        body=json.dumps({"urls": urls}),
    )

    if resp.status not in (200, 204):
        try:
            details = await resp.json()
        except Exception:
            details = await resp.text()
        raise RuntimeError(f"Blob delete failed (status {resp.status}): {details}")

    if resp.status == 204:
        return {"deleted": urls}

    return await resp.json()
