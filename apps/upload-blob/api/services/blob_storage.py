import vercel_blob
from werkzeug.utils import secure_filename
from pathlib import Path
import redis
import json
from ..config import Settings

class BlobStorageService:
    """
    Service for interacting with Vercel Blob storage.
    Follows SRP by focusing on blob operations.
    """
    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis_client = (
            redis.Redis.from_url(settings.REDIS_URL) 
            if settings.REDIS_URL else None
        )
        self.CACHE_KEY = "blob_files_cache"

    def get_cached_blobs(self):
        if not self.redis_client:
            return None
        cached_data = self.redis_client.get(self.CACHE_KEY)
        if cached_data:
            return json.loads(cached_data)
        return None

    def set_cached_blobs(self, data):
        if self.redis_client:
            self.redis_client.set(
                self.CACHE_KEY, 
                json.dumps(data), 
                ex=self.settings.CACHE_TTL
            )

    def invalidate_cache(self):
        if self.redis_client:
            self.redis_client.delete(self.CACHE_KEY)

    def upload_to_blob_storage(
        self, filename: str, contents: bytes, blob_path: str, allow_overwrite: bool = False
    ) -> tuple[str, str]:
        sanitized_filename = secure_filename(filename)
        prefix = self.settings.BLOB_PREFIX.rstrip("/")
        clean_blob_path = blob_path.strip("/")

        # Check if the filename already has a markdown extension
        if sanitized_filename.lower().endswith((".md", ".markdown")):
            # Save without appending .txt
            path = f"{prefix}/{clean_blob_path}/{sanitized_filename}"
        else:
            # Maintain existing logic for all other files
            path = f"{prefix}/{clean_blob_path}/{sanitized_filename}.txt"

        # Explicitly pass the token to vercel_blob.put if possible, 
        # but vercel_blob usually uses the environment variable.
        # We've already centralized it in config, which loads it into environ.
        blob_result = vercel_blob.put(path, contents, {"allowOverwrite": allow_overwrite})

        # Invalidate cache on new upload
        self.invalidate_cache()

        return blob_result["url"], path

    def list_blobs(self):
        # Try to get from cache first
        cached_data = self.get_cached_blobs()
        if cached_data is not None:
            return cached_data

        # Wrap the prefix in an options dictionary
        options = {"prefix": self.settings.BLOB_PREFIX}
        result = vercel_blob.list(options)

        # Access the list of blobs from the result
        blobs_list = result.get("blobs", [])

        groups = {}

        for blob in blobs_list:
            pathname = blob.get("pathname", "")
            url = blob.get("url")
            uploaded_at = blob.get("uploadedAt")

            # Group by the parent directory
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

            # Update timestamp to the latest file in that directory
            if uploaded_at and (
                not groups[parent_dir]["timestamp"]
                or uploaded_at > groups[parent_dir]["timestamp"]
            ):
                groups[parent_dir]["timestamp"] = uploaded_at

            # Map files based on suffix
            if filename.endswith(".md"):
                groups[parent_dir]["md_url"] = url
            elif filename.endswith(".txt"):
                groups[parent_dir]["txt_url"] = url

        # Sort by path for consistent output
        sorted_groups = [groups[k] for k in sorted(groups.keys())]

        # Save to cache
        self.set_cached_blobs(sorted_groups)

        return sorted_groups

    def delete_from_blob_storage(self, url: str):
        """
        Deletes a blob directly using its URL.
        This saves one Advanced Operation by avoiding the list() call.
        """
        try:
            vercel_blob.delete(url)
            self.invalidate_cache()
            return True
        except Exception:
            return False

# For backward compatibility if needed during refactoring
from ..config import settings
_default_service = BlobStorageService(settings)

def upload_to_blob_storage(*args, **kwargs):
    return _default_service.upload_to_blob_storage(*args, **kwargs)

def list_blobs(*args, **kwargs):
    return _default_service.list_blobs(*args, **kwargs)

def delete_from_blob_storage(*args, **kwargs):
    return _default_service.delete_from_blob_storage(*args, **kwargs)

def invalidate_cache(*args, **kwargs):
    return _default_service.invalidate_cache(*args, **kwargs)
