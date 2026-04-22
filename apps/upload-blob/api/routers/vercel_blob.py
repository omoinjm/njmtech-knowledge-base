from fastapi import APIRouter, UploadFile, File, Depends, Query
from fastapi.responses import JSONResponse
from ..dependencies import verify_token, get_blob_service
from ..services.blob_storage import BlobStorageService
from ..helpers.blob import get_filename

router = APIRouter(tags=["Vercel Blob"])


@router.get("/", summary="Root endpoint")
async def read_root():
    """Returns a simple welcome message."""
    return JSONResponse(
        status_code=200, content={"message": "Welcome to the Vercel Blob API"}
    )


@router.get("/files", dependencies=[Depends(verify_token)], summary="List all files")
async def list_files(blob_service: BlobStorageService = Depends(get_blob_service)):
    """
    Returns a list of all files in Vercel Blob storage, grouped by their parent directory.
    Each record includes the timestamp, .txt URL, and .md.txt URL where applicable.
    """
    return JSONResponse(status_code=200, content={"data": blob_service.list_blobs()})


@router.delete("/delete", dependencies=[Depends(verify_token)], summary="Delete a blob")
async def delete_blob(
    url: str = Query(..., description="The absolute URL of the blob to delete"),
    blob_service: BlobStorageService = Depends(get_blob_service)
):
    """
    Deletes a single blob from storage using its absolute URL.
    Returns 404 if deletion fails.
    """
    success = blob_service.delete_from_blob_storage(url)
    if success:
        return JSONResponse(
            status_code=200, content={"message": "Blob deleted successfully"}
        )
    else:
        return JSONResponse(status_code=404, content={"message": "Blob not found or deletion failed"})


@router.post("/upload", dependencies=[Depends(verify_token)], summary="Upload a file")
async def upload(
    blob_path: str = Query("uploads", description="The directory path in blob storage"),
    allow_overwrite: bool = Query(
        False, description="Whether to allow overwriting existing files"
    ),
    file: UploadFile = File(..., description="The file to upload"),
    blob_service: BlobStorageService = Depends(get_blob_service)
):
    """
    Uploads a file to the specified directory in Vercel Blob storage.
    Automatically appends .txt extension for consistency.
    """
    contents = await file.read()

    file_size = len(contents)
    content_type = file.content_type
    pathname = file.filename

    url, stored_pathname = blob_service.upload_to_blob_storage(
        get_filename(file),
        contents,
        blob_path,
        allow_overwrite=allow_overwrite,
    )

    return JSONResponse(
        status_code=200,
        content={
            "url": url,
            "pathname": stored_pathname or pathname,
            "content_type": content_type,
            "size": file_size,
        },
    )
