import pytest
from njm_blob_cron import config
import os

def test_validate_config_missing_vars(monkeypatch):
    """
    Tests that validate_config raises a ValueError if required
    environment variables are missing.
    """
    monkeypatch.delenv("BLOB_API_URL", raising=False)
    with pytest.raises(ValueError, match="Missing required environment variables: BLOB_API_URL"):
        config.validate_config()

def test_validate_config_all_vars_present(monkeypatch):
    """
    Tests that validate_config runs without error if all required
    environment variables are present.
    """
    monkeypatch.setenv("BLOB_API_URL", "https://api.vercel.com")
    monkeypatch.setenv("VERCEL_BLOB_TOKEN", "test_token")
    monkeypatch.setenv("BLOB_STORE_ID", "test_store_id")
    try:
        config.validate_config()
    except ValueError:
        pytest.fail("validate_config() raised ValueError unexpectedly!")
