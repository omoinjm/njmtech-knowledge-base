import pytest
from njm_blob_cron import config
import os

def test_validate_config_missing_vars(monkeypatch):
    """
    Tests that validate_config raises a ValueError if required
    environment variables are missing.
    """
    monkeypatch.delenv("UPLOAD_BLOB_API_URL", raising=False)
    monkeypatch.delenv("BLOB_API_URL", raising=False)
    monkeypatch.delenv("UPLOAD_BLOB_API_TOKEN", raising=False)
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "test_account")
    monkeypatch.setenv("CLOUDFLARE_D1_DATABASE_ID", "test_db_id")
    monkeypatch.setenv("CLOUDFLARE_D1_API_TOKEN", "test_token")
    with pytest.raises(ValueError, match="Missing required environment variables: UPLOAD_BLOB_API_TOKEN"):
        config.validate_config()

def test_validate_config_all_vars_present(monkeypatch):
    """
    Tests that validate_config runs without error if all required
    environment variables are present.
    """
    monkeypatch.setenv("UPLOAD_BLOB_API_URL", "https://upload.example.com")
    monkeypatch.setenv("UPLOAD_BLOB_API_TOKEN", "test_token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "test_account")
    monkeypatch.setenv("CLOUDFLARE_D1_DATABASE_ID", "test_db_id")
    monkeypatch.setenv("CLOUDFLARE_D1_API_TOKEN", "test_token")
    try:
        config.validate_config()
    except ValueError:
        pytest.fail("validate_config() raised ValueError unexpectedly!")
