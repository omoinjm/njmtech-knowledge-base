import asyncio
import os
import logging
from njm_blob_cron.blob_storage.base import BlobStorage
from njm_blob_cron.processing.base import FileProcessor
from njm_blob_cron.config import ROOT_SCAN_FOLDER
from njm_blob_cron.database import db_pool
from collections import defaultdict
from typing import List, Dict, Any

class DirectoryScanner:
    """
    Scans a blob storage container, identifies directories that meet
    specific criteria, and triggers a file processor for them concurrently.
    This class encapsulates the core business logic of the application.
    """

    def __init__(self, blob_storage: BlobStorage, file_processor: FileProcessor, reprocess_all: bool = False):
        """
        Initializes the DirectoryScanner.

        Args:
            blob_storage: An object that conforms to the BlobStorage interface.
            file_processor: An object that conforms to the FileProcessor interface.
        """
        self.blob_storage = blob_storage
        self.file_processor = file_processor
        self.reprocess_all = reprocess_all

    async def scan_and_process(self):
        """
        Starts the scanning and processing workflow.
        """
        print(f"Starting scan in root folder: '{ROOT_SCAN_FOLDER}'")
        directories = await self.blob_storage.list(folder=ROOT_SCAN_FOLDER)

        print(f"Found {len(directories)} directories to evaluate.")

        # Identify all files that need processing
        files_to_process = []
        for dir_record in directories:
            qualifying_file = self._get_qualifying_file(dir_record)
            if qualifying_file:
                files_to_process.append(qualifying_file)

        # Process files sequentially
        if not files_to_process:
            print("No files to process.")
        else:
            print(f"Found {len(files_to_process)} files to process sequentially.")
            for file in files_to_process:
                await self._process_file(file)
        
        print("Scan finished.")

    def _get_qualifying_file(self, dir_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applies file evaluation rules to a directory record.
        """
        directory = dir_record.get('pathname', 'Unknown')
        print(f"Evaluating directory: '{directory}'")
        
        txt_url = dir_record.get('txt_url')
        md_url = dir_record.get('md_url')

        if md_url and not self.reprocess_all:
            print(f"  [SKIP] Directory already contains a processed file (.md).")
            return None

        if txt_url:
            # We construct a filename for the transcript. 
            # The API doesn't give the filename separately, so we derive it or use a default.
            # Based on logs, it's usually yt-transcribe_...txt or transcript.txt
            filename = os.path.basename(txt_url)
            
            # The _process_file method needs 'pathname' (full target path) and 'url' (download link)
            # We'll use the directory path + derived filename for the source pathname
            source_pathname = f"{directory}/{filename}"
            
            mode = "REPROCESS" if self.reprocess_all else "QUALIFIES"
            print(f"  [{mode}] Found transcript file: {source_pathname}")
            return {
                'pathname': source_pathname,
                'url': txt_url
            }
        
        print(f"  [SKIP] Directory does not contain any transcript files (.txt).")
        return None

    async def _process_file(self, file_to_process: Dict[str, Any]):
        """
        Downloads, processes, and handles errors for a single file.
        """
        pathname = file_to_process['pathname']
        url = file_to_process.get('url')
        try:
            print(f"  [PROCESS] Starting processing for: {pathname}")
            file_content_bytes = await self.blob_storage.download(pathname, url=url)
            file_content = file_content_bytes.decode('utf-8')
            
            notes_url = await self.file_processor.process(file_content, pathname)

            if notes_url:
                print(f"  [DB_UPDATE] Updating database for: {pathname}")
                if self.reprocess_all:
                    query = """
                        UPDATE media_items
                        SET notes_url = $1
                        WHERE transcript_url = $2;
                    """
                else:
                    query = """
                        UPDATE media_items
                        SET notes_url = $1
                        WHERE transcript_url = $2 AND notes_url IS NULL;
                    """
                await db_pool.execute(query, notes_url, url)
                print(f"  [SUCCESS] Database updated with notes_url: {notes_url}")

        except Exception as e:
            print(f"  [ERROR] Failed to process file {pathname}: {e}")

