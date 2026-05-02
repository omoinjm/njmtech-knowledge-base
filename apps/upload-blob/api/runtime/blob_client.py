import hashlib
import hmac
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import quote, urlparse
import xml.etree.ElementTree as ET

from workers import fetch


EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()


def _hash_payload(payload: bytes | None) -> str:
    return hashlib.sha256(payload or b"").hexdigest()


def _sign(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()


def _derive_signing_key(secret_key: str, date_stamp: str, region: str) -> bytes:
    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, "s3")
    return _sign(k_service, "aws4_request")


def _canonical_uri(path: str) -> str:
    return quote(path or "/", safe="/-_.~")


def _canonical_querystring(params: dict[str, str] | None) -> str:
    if not params:
        return ""

    encoded_items = []
    for key, value in sorted((str(k), str(v)) for k, v in params.items()):
        encoded_items.append(
            f"{quote(key, safe='-_.~')}={quote(value, safe='-_.~')}"
        )
    return "&".join(encoded_items)


def _normalized_headers(host: str, payload_hash: str, headers: dict[str, str] | None = None):
    normalized = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
    }
    for key, value in (headers or {}).items():
        normalized[key.lower()] = " ".join(str(value).strip().split())
    return normalized


def _signed_headers(settings, method: str, url: str, params: dict[str, str] | None, payload_hash: str, headers: dict[str, str] | None = None):
    parsed = urlparse(url)
    canonical_headers = _normalized_headers(parsed.netloc, payload_hash, headers)
    signed_header_names = sorted(canonical_headers.keys())
    canonical_headers_str = "".join(
        f"{name}:{canonical_headers[name]}\n" for name in signed_header_names
    )
    signed_headers = ";".join(signed_header_names)
    amz_date = canonical_headers["x-amz-date"]
    date_stamp = amz_date[:8]
    credential_scope = f"{date_stamp}/{settings.CLOUDFLARE_S3_REGION}/s3/aws4_request"
    canonical_request = "\n".join(
        [
            method,
            _canonical_uri(parsed.path),
            _canonical_querystring(params),
            canonical_headers_str,
            signed_headers,
            payload_hash,
        ]
    )
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    signing_key = _derive_signing_key(
        settings.CLOUDFLARE_S3_SECRET_ACCESS_KEY,
        date_stamp,
        settings.CLOUDFLARE_S3_REGION,
    )
    signature = hmac.new(
        signing_key,
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    canonical_headers["authorization"] = (
        "AWS4-HMAC-SHA256 "
        f"Credential={settings.CLOUDFLARE_S3_ACCESS_KEY_ID}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )
    return canonical_headers


def _bucket_base_url(settings) -> str:
    return f"{settings.CLOUDFLARE_S3_API_URL.rstrip('/')}/{settings.CLOUDFLARE_S3_BUCKET}"


def _object_storage_url(settings, pathname: str) -> str:
    quoted_path = quote(pathname.lstrip("/"), safe="/-_.~")
    return f"{_bucket_base_url(settings)}/{quoted_path}"


def _object_public_url(settings, pathname: str) -> str:
    base_url = settings.CLOUDFLARE_S3_PUBLIC_BASE_URL
    if base_url:
        return f"{base_url.rstrip('/')}/{quote(pathname.lstrip('/'), safe='/-_.~')}"
    return _object_storage_url(settings, pathname)


def _assert_storage_settings(settings):
    required = {
        "CLOUDFLARE_S3_API_URL": settings.CLOUDFLARE_S3_API_URL,
        "CLOUDFLARE_S3_ACCESS_KEY_ID": settings.CLOUDFLARE_S3_ACCESS_KEY_ID,
        "CLOUDFLARE_S3_SECRET_ACCESS_KEY": settings.CLOUDFLARE_S3_SECRET_ACCESS_KEY,
        "CLOUDFLARE_S3_BUCKET": settings.CLOUDFLARE_S3_BUCKET,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            f"Missing required storage configuration: {', '.join(sorted(missing))}"
        )


async def _signed_fetch(settings, method: str, url: str, params: dict[str, str] | None = None, headers: dict[str, str] | None = None, body: bytes | None = None):
    _assert_storage_settings(settings)
    payload_hash = _hash_payload(body)
    signed_headers = _signed_headers(settings, method, url, params, payload_hash, headers)
    request_url = url
    querystring = _canonical_querystring(params)
    if querystring:
        request_url = f"{request_url}?{querystring}"
    return await fetch(
        request_url,
        method=method,
        headers=signed_headers,
        body=body,
    )


def _parse_list_response(xml_payload: str):
    root = ET.fromstring(xml_payload)
    namespace = ""
    if root.tag.startswith("{"):
        namespace = root.tag.split("}", 1)[0] + "}"

    return root.findall(f"{namespace}Contents")


def _extract_object_key_from_url(settings, value: str) -> str:
    if "://" not in value:
        return value.lstrip("/")

    parsed = urlparse(value)
    public_base = (settings.CLOUDFLARE_S3_PUBLIC_BASE_URL or "").rstrip("/")
    if public_base and value.startswith(public_base + "/"):
        return value[len(public_base) + 1 :].lstrip("/")

    api_prefix = _bucket_base_url(settings).rstrip("/")
    if value.startswith(api_prefix + "/"):
        return value[len(api_prefix) + 1 :].lstrip("/")

    bucket_prefix = f"/{settings.CLOUDFLARE_S3_BUCKET.strip('/')}/"
    if parsed.path.startswith(bucket_prefix):
        return parsed.path[len(bucket_prefix) :].lstrip("/")

    return parsed.path.lstrip("/")


async def _object_exists(settings, pathname: str) -> bool:
    response = await _signed_fetch(
        settings,
        "HEAD",
        _object_storage_url(settings, pathname),
    )
    if response.status == 200:
        return True
    if response.status == 404:
        return False

    details = await response.text()
    raise RuntimeError(
        f"Object existence check failed for '{pathname}' (status {response.status}): {details}"
    )


async def list_blobs(settings):
    params = {"list-type": "2", "max-keys": "1000", "prefix": settings.BLOB_PREFIX}
    response = await _signed_fetch(
        settings,
        "GET",
        _bucket_base_url(settings),
        params=params,
    )

    if response.status != 200:
        try:
            details = await response.json()
        except Exception:
            details = await response.text()
        raise RuntimeError(
            f"Blob API request failed (status {response.status}): {details}"
        )

    blobs_list = _parse_list_response(await response.text())

    groups = {}
    for blob in blobs_list:
        pathname = blob.findtext("./{*}Key", default="")
        uploaded_at = blob.findtext("./{*}LastModified")

        p = PurePosixPath(pathname)
        parent_dir = str(p.parent)
        filename = p.name

        if parent_dir not in groups:
            groups[parent_dir] = {
                "path": parent_dir,
                "pathname": parent_dir,
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
            groups[parent_dir]["md_url"] = _object_public_url(settings, pathname)
        elif filename.endswith(".txt"):
            groups[parent_dir]["txt_url"] = _object_public_url(settings, pathname)

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


def _sanitize_path_segment(segment: str) -> str:
    cleaned = []
    last_was_sep = False
    for char in (segment or ""):
        if char.isalnum() or char in {".", "_", "-"}:
            cleaned.append(char)
            last_was_sep = False
        else:
            if not last_was_sep:
                cleaned.append("_")
                last_was_sep = True
    sanitized = "".join(cleaned).strip("._-")
    return sanitized


def _sanitize_blob_path(blob_path: str) -> str:
    parts = [p for p in (blob_path or "").split("/") if p]
    cleaned_parts = []
    for part in parts:
        cleaned = _sanitize_path_segment(part)
        if cleaned:
            cleaned_parts.append(cleaned)
    return "/".join(cleaned_parts)


def build_blob_pathname(settings, blob_path: str, filename: str) -> str:
    prefix = settings.BLOB_PREFIX.rstrip("/")
    clean_blob_path = _sanitize_blob_path((blob_path or "").strip("/"))
    sanitized_filename = _sanitize_filename(filename)

    parts = [prefix]

    # If blob_path already targets a specific file (for example `folder/name.srt`),
    # use it directly and do not append an additional filename.
    path_parts = [p for p in clean_blob_path.split("/") if p]
    last_segment = path_parts[-1] if path_parts else ""
    if "." in last_segment and not last_segment.startswith(".") and not last_segment.endswith("."):
        if clean_blob_path:
            parts.append(clean_blob_path)
        return "/".join(parts)

    if "." in sanitized_filename and not sanitized_filename.endswith("."):
        leaf_name = sanitized_filename
    else:
        leaf_name = f"{sanitized_filename}.txt"

    if clean_blob_path:
        parts.append(clean_blob_path)
    parts.append(leaf_name)
    return "/".join(parts)


async def upload_blob(settings, pathname: str, file_bytes: bytes, content_type: str | None, allow_overwrite: bool = False):
    if not allow_overwrite and await _object_exists(settings, pathname):
        raise RuntimeError(f"Blob already exists at pathname '{pathname}'")

    headers = {}
    if content_type:
        headers["content-type"] = content_type

    response = await _signed_fetch(
        settings,
        "PUT",
        _object_storage_url(settings, pathname),
        headers=headers,
        body=file_bytes,
    )

    if response.status in (200, 201):
        return {
            "url": _object_public_url(settings, pathname),
            "pathname": pathname,
            "contentType": content_type or "application/octet-stream",
        }
    try:
        details = await response.text()
    except Exception:
        details = "<unavailable>"
    raise RuntimeError(
        f"Blob upload failed for pathname '{pathname}' (status {response.status}): {details}"
    )


async def delete_blob(settings, urls: list[str]):
    deleted = []
    for url in urls:
        pathname = _extract_object_key_from_url(settings, url)
        response = await _signed_fetch(
            settings,
            "DELETE",
            _object_storage_url(settings, pathname),
        )
        if response.status not in (200, 204):
            details = await response.text()
            raise RuntimeError(
                f"Blob delete failed for '{pathname}' (status {response.status}): {details}"
            )
        deleted.append(pathname)

    return {"deleted": deleted}
