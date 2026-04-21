import asyncio
from typing import List, Dict, Any
import os
import httpx

from njm_blob_cron.blob_storage.base import BlobStorage
from njm_blob_cron.config import VERCEL_BLOB_TOKEN, BLOB_API_URL, ROOT_SCAN_FOLDER

class VercelBlobStorage(BlobStorage):
    """
    Concrete implementation of the BlobStorage interface for Vercel Blob Storage
    using direct 'httpx' calls to the custom NJMTech Blob API.
    """

    def __init__(self):
        if not VERCEL_BLOB_TOKEN:
            raise ValueError("VERCEL_BLOB_TOKEN is not set.")
        if not BLOB_API_URL:
            raise ValueError("BLOB_API_URL is not set.")
        
        self.base_url = BLOB_API_URL.rstrip('/')
        self.headers = {
            "Authorization": f"Bearer {VERCEL_BLOB_TOKEN}"
        }

    async def list(self, folder: str) -> List[Dict[str, Any]]:
        """
        Lists all blobs using the /api/v1/blob/files endpoint.
        """
        try:
            async with httpx.AsyncClient() as client:
                # The custom API uses /api/v1/blob/files
                # Note: The API doesn't seem to support prefix/limit in the spec,
                # so we list all and filter locally if needed, or assume the API handles it.
                response = await client.get(
                    f"{self.base_url}/api/v1/blob/files",
                    headers=self.headers
                )
                
                if response.status_code != 200:
                    print(f"Error listing blobs (Status {response.status_code}): {response.text}")
                    return []
                
                # The response structure is {"data": [{"url": "...", "path": "..."}]}
                data = response.json()
                raw_blobs = data.get('data', [])
                
                # Convert 'path' to 'pathname' for internal consistency
                blobs = []
                for b in raw_blobs:
                    pathname = b.get('path', '')
                    # Filter by folder (prefix) if provided
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
            # If a URL is not provided, fetch it by listing.
            if not url:
                blobs = await self.list(folder=pathname)
                match = next((b for b in blobs if b['pathname'] == pathname), None)
                
                if not match:
                    raise FileNotFoundError(f"Blob with pathname '{pathname}' not found.")
                
                url = match['url']
            
            # Fetch content via HTTP GET
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=self.headers)
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
                # The custom API seems to prepend ROOT_SCAN_FOLDER and 
                # treats 'blob_path' as the target directory.
                
                # Strip the root folder from the pathname if present to get clean_path
                clean_path = pathname
                prefix = f"{ROOT_SCAN_FOLDER}/"
                if pathname.startswith(prefix):
                    clean_path = pathname[len(prefix):]
                
                # The backend logic you shared already adds 'njmtech-blob-api/'
                # So we send the directory path WITHOUT the root folder.
                target_dir = os.path.dirname(clean_path)
                filename = os.path.basename(clean_path)
                
                target_url = f"{self.base_url}/api/v1/blob/upload"
                
                # The API expects 'blob_path' in query (the directory) 
                # and 'file' in multipart body (the filename and content)
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
                # The response structure from backend logic shows 'url' is in the root of result
                return result
        except Exception as e:
            print(f"Error uploading blob '{pathname}': {e}")
            raise

    async def delete(self, pathname: str) -> bool:
        """
        Deletes a blob using the /api/v1/blob/delete endpoint.
        """
        try:
            from njm_blob_cron.config import ROOT_SCAN_FOLDER
            
            async with httpx.AsyncClient() as client:
                target_url = f"{self.base_url}/api/v1/blob/delete"
                
                # Try full path first
                response = await client.delete(
                    target_url,
                    params={"blob_path": pathname},
                    headers=self.headers
                )
                
                if response.status_code in (200, 204):
                    return True
                
                # If 404, try cleaned path
                clean_path = pathname
                prefix = f"{ROOT_SCAN_FOLDER}/"
                if pathname.startswith(prefix):
                    clean_path = pathname[len(prefix):]
                
                if clean_path != pathname:
                    response = await client.delete(
                        target_url,
                        params={"blob_path": clean_path},
                        headers=self.headers
                    )
                    if response.status_code in (200, 204):
                        return True

                print(f"Error deleting blob (Status {response.status_code}): {response.text}")
                return False
        except Exception as e:
            print(f"Error deleting blob '{pathname}': {e}")
            return False
