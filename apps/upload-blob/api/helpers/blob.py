from fastapi import UploadFile, HTTPException


def get_filename(file: UploadFile) -> str:
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Filename is required")
    return file.filename
