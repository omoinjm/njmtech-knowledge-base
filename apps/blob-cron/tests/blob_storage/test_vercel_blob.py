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


def test_blob_api_storage_robust_url_initialization(monkeypatch):
    """
    Tests that the blob API storage class handles misconfigured URLs robustly.
    """
    monkeypatch.setenv("UPLOAD_BLOB_API_TOKEN", "test-token")
    
    # Test with /api/v1/blob/upload suffix
    monkeypatch.setenv("UPLOAD_BLOB_API_URL", "https://api.example.com/api/v1/blob/upload")
    storage = BlobAPIStorage()
    assert storage.base_url == "https://api.example.com"
    
    # Test with /api/v1/blob suffix
    monkeypatch.setenv("UPLOAD_BLOB_API_URL", "https://api.example.com/api/v1/blob")
    storage = BlobAPIStorage()
    assert storage.base_url == "https://api.example.com"

    # Test with /api/v1/blob/files suffix
    monkeypatch.setenv("UPLOAD_BLOB_API_URL", "https://api.example.com/api/v1/blob/files/")
    storage = BlobAPIStorage()
    assert storage.base_url == "https://api.example.com"
