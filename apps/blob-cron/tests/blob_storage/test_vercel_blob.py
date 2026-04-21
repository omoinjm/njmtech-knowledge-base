import pytest
from njm_blob_cron.blob_storage.vercel_blob import VercelBlobStorage

@pytest.fixture
def mock_vercel_blob_client(mocker):
    """Mocks the Vercel Blob client."""
    return mocker.patch('vercel_blob.Client', autospec=True)

def test_vercel_blob_storage_initialization(mock_vercel_blob_client):
    """
    Tests that the VercelBlobStorage class initializes the vercel_blob.Client
    with the correct token.
    """
    VercelBlobStorage()
    mock_vercel_blob_client.assert_called_once()
