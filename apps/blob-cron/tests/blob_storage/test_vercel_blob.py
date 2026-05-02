import pytest
from njm_blob_cron.blob_storage.vercel_blob import BlobAPIStorage

def test_blob_api_storage_initialization(monkeypatch):
    """
    Tests that the blob API storage class initializes with the configured API settings.
    """
    monkeypatch.setenv("UPLOAD_BLOB_API_URL", "https://upload.example.com")
    monkeypatch.setenv("UPLOAD_BLOB_API_TOKEN", "test-token")

    storage = BlobAPIStorage()

    assert storage.base_url == "https://upload.example.com"
    assert storage.headers["Authorization"] == "Bearer test-token"
