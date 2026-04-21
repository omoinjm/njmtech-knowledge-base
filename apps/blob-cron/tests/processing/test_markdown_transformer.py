import pytest
from njm_blob_cron.processing.markdown_transformer import MarkdownTransformer
from njm_blob_cron.blob_storage.base import BlobStorage
import ollama
import os

class MockBlobStorage(BlobStorage):
    async def list(self, folder: str):
        pass
    async def download(self, pathname: str, url: str = None):
        pass
    async def upload(self, pathname: str, content: bytes):
        pass
    async def delete(self, pathname: str):
        pass

@pytest.fixture
def markdown_transformer():
    """Returns a MarkdownTransformer instance with a mock blob storage."""
    return MarkdownTransformer(blob_storage=MockBlobStorage())

def test_build_prompt(markdown_transformer):
    """
    Tests that the _build_prompt method correctly constructs the prompt.
    """
    text = "This is a test transcript."
    prompt = markdown_transformer._build_prompt(text)
    assert "You are an expert technical writer" in prompt
    assert "This is a test transcript." in prompt
