import pytest
from njm_blob_cron.scanner.directory_scanner import DirectoryScanner
from njm_blob_cron.blob_storage.base import BlobStorage
from njm_blob_cron.processing.base import FileProcessor

class MockFileProcessor(FileProcessor):
    async def process(self, file_content: str, source_pathname: str):
        pass

class MockBlobStorage(BlobStorage):
    def __init__(self, blobs):
        self._blobs = blobs

    async def list(self, folder: str):
        return self._blobs
    async def download(self, pathname: str, url: str = None):
        pass
    async def upload(self, pathname: str, content: bytes):
        pass
    async def delete(self, pathname: str):
        pass

@pytest.mark.asyncio
async def test_scan_and_process_qualifying_file():
    """
    Tests that the scanner correctly identifies and processes a single .txt file
    in a directory.
    """
    # Note: the scanner now filters out duplicated root folders
    blobs = [{'pathname': 'njmtech-blob-api/test_dir/test.txt'}]
    blob_storage = MockBlobStorage(blobs)
    file_processor = MockFileProcessor()
    scanner = DirectoryScanner(blob_storage, file_processor)

    # To check if process method was called, we can monkeypatch it
    import asyncio
    processed_files = []
    async def mock_process(file_content, source_pathname):
        processed_files.append(source_pathname)
        await asyncio.sleep(0)

    file_processor.process = mock_process
    
    await scanner.scan_and_process()

    assert len(processed_files) == 1
    assert processed_files[0] == 'njmtech-blob-api/test_dir/test.txt'

@pytest.mark.asyncio
async def test_scan_and_process_non_qualifying_file_md():
    """
    Tests that the scanner skips directories containing .md files.
    """
    blobs = [
        {'pathname': 'njmtech-blob-api/test_dir/test.txt'},
        {'pathname': 'njmtech-blob-api/test_dir/test.md'}
    ]
    blob_storage = MockBlobStorage(blobs)
    file_processor = MockFileProcessor()
    scanner = DirectoryScanner(blob_storage, file_processor)

    processed_files = []
    async def mock_process(file_content, source_pathname):
        processed_files.append(source_pathname)
    file_processor.process = mock_process
    
    await scanner.scan_and_process()

    assert len(processed_files) == 0

@pytest.mark.asyncio
async def test_scan_and_process_skip_no_transcript():
    """
    Tests that the scanner skips directories without any transcript files.
    """
    blobs = [{'pathname': 'njmtech-blob-api/test_dir/orphaned.md'}]
    blob_storage = MockBlobStorage(blobs)
    file_processor = MockFileProcessor()
    scanner = DirectoryScanner(blob_storage, file_processor)

    processed_files = []
    async def mock_process(file_content, source_pathname):
        processed_files.append(source_pathname)
    file_processor.process = mock_process
    
    await scanner.scan_and_process()

    assert len(processed_files) == 0
