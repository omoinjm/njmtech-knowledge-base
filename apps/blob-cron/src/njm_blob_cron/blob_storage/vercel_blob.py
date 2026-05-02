from typing import List, Dict, Any
import os
import httpx

from njm_blob_cron.blob_storage.base import BlobStorage
from njm_blob_cron.config import (
    ROOT_SCAN_FOLDER,
    get_upload_blob_api_token,
    get_upload_blob_api_url,
)


class BlobAPIStorage(BlobStorage):
    """
    Concrete implementation of the BlobStorage interface for the upload-blob API.
    """

    def __init__(self):
        api_token = get_upload_blob_api_token()
        api_url = get_upload_blob_api_url()

        if not api_token:
            raise ValueError("UPLOAD_BLOB_API_TOKEN is not set.")
        if not api_url:
            raise ValueError("UPLOAD_BLOB_API_URL is not set.")

        self.base_url = api_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {api_token}"
        }

    async def list(self, folder: str) -> List[Dict[str, Any]]:
        """
        Lists all blobs using the /api/v1/blob/files endpoint.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/blob/files",
                    headers=self.headers
                )
                
                if response.status_code != 200:
                    print(f"Error listing blobs (Status {response.status_code}): {response.text}")
                    return []
                
                data = response.json()
                raw_blobs = data.get('data', [])

                blobs = []
                for b in raw_blobs:
                    pathname = b.get('path', '')
                    if not folder or pathname.startswith(folder):
                        blobs.append({
                            'pathname': pathname,
                            'txt_url': b.get('txt_url'),
                            'md_url': b.get('md_url')
                        })
                
                return blobs
        except Exception as e:
            print(f"Error listing blobs in folder '{folder}': {e}")
            return []

    async def download(self, pathname: str, url: str = None) -> bytes:
        """
        Downloads a blob's content.
        """
        try:
            if not url:
                blobs = await self.list(folder=pathname)
                match = next((b for b in blobs if b['pathname'] == pathname), None)
                if not match:
                    raise FileNotFoundError(f"Blob with pathname '{pathname}' not found.")

                if pathname.endswith(".md"):
                    url = match.get("md_url")
                else:
                    url = match.get("txt_url")
                if not url:
                    raise FileNotFoundError(f"Blob URL for '{pathname}' not found.")

            async with httpx.AsyncClient() as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except Exception as e:
            print(f"Error downloading blob '{pathname}': {e}")
            raise

    async def upload(self, pathname: str, content: bytes) -> Dict[str, Any]:
        """
        Uploads content using the /api/v1/blob/upload endpoint.
        """
        try:
            async with httpx.AsyncClient() as client:
                clean_path = pathname
                prefix = f"{ROOT_SCAN_FOLDER}/"
                if pathname.startswith(prefix):
                    clean_path = pathname[len(prefix):]

                target_dir = os.path.dirname(clean_path)
                filename = os.path.basename(clean_path)

                target_url = f"{self.base_url}/api/v1/blob/upload"
                files = {'file': (filename, content, 'text/markdown')}
                params = {
                    "blob_path": target_dir,
                    "allow_overwrite": "true"
                }

                response = await client.post(
                    target_url,
                    params=params,
                    files=files,
                    headers=self.headers
                )
                
                if response.status_code not in (200, 201):
                    print(f"Error uploading blob (Status {response.status_code}): {response.text}")
                    raise Exception(f"Upload failed: {response.text}")
                
                result = response.json()
                return result
        except Exception as e:
            print(f"Error uploading blob '{pathname}': {e}")
            raise

    async def delete(self, pathname: str) -> bool:
        """
        Deletes a blob using the /api/v1/blob/delete endpoint.
        """
        try:
            async with httpx.AsyncClient() as client:
                target_url = f"{self.base_url}/api/v1/blob/delete"

                response = await client.delete(
                    target_url,
                    params={"url": pathname},
                    headers=self.headers
                )

                if response.status_code in (200, 204):
                    return True

                clean_path = pathname
                prefix = f"{ROOT_SCAN_FOLDER}/"
                if pathname.startswith(prefix):
                    clean_path = pathname[len(prefix):]

                if clean_path != pathname:
                    response = await client.delete(
                        target_url,
                        params={"url": clean_path},
                        headers=self.headers
                    )
                    if response.status_code in (200, 204):
                        return True

                print(f"Error deleting blob (Status {response.status_code}): {response.text}")
                return False
        except Exception as e:
            print(f"Error deleting blob '{pathname}': {e}")
            return False


VercelBlobStorage = BlobAPIStorage
