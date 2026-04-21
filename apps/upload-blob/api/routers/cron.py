from fastapi import APIRouter, HTTPException, Header, Depends
from ..dependencies import get_settings, get_blob_service
from ..config import Settings
from ..services.blob_storage import BlobStorageService

router = APIRouter(prefix="/api/cron", tags=["Cron"])

@router.get("/refresh-cache")
async def refresh_cache(
    authorization: str = Header(None),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service)
):
    """
    Cron job to refresh the blob list cache.
    Hobby plan allows 1 cron job per day.
    """
    if settings.CRON_SECRET and authorization != f"Bearer {settings.CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Invalidate existing cache
    blob_service.invalidate_cache()
    
    # Trigger a new list() call to re-populate cache
    # This uses 1 Advanced Operation once a day
    data = blob_service.list_blobs()
    
    return {"status": "success", "message": "Cache refreshed", "items": len(data)}
