#!/usr/bin/env python3
import asyncio
import os
import sys
import logging

# Add src to PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from njm_blob_cron.blob_storage.vercel_blob import BlobAPIStorage
from njm_blob_cron.database import db_pool
from njm_blob_cron.config import ROOT_SCAN_FOLDER, validate_config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

async def sync_existing_notes():
    """
    One-time script to sync existing .md files from object storage to the media_items table.
    """
    logging.info("Starting sync of existing notes...")

    try:
        # 1. Validate configuration
        validate_config()
        
        # 2. Initialize components
        blob_storage = BlobAPIStorage()
        await db_pool.connect()

        # 3. List all directories/blobs
        logging.info(f"Listing blobs in '{ROOT_SCAN_FOLDER}'...")
        directories = await blob_storage.list(folder=ROOT_SCAN_FOLDER)
        
        updates_count = 0
        
        for dir_record in directories:
            txt_url = dir_record.get('txt_url')
            md_url = dir_record.get('md_url')
            pathname = dir_record.get('pathname')

            if txt_url and md_url:
                logging.info(f"Checking database for: {pathname}")
                
                # Update the database if notes_url is NULL for this transcript_url
                query = """
                    UPDATE media_items 
                    SET notes_url = $1 
                    WHERE transcript_url = $2 AND notes_url IS NULL;
                """
                
                # execute() returns a status string like "UPDATE 1" or "UPDATE 0"
                result = await db_pool.execute(query, md_url, txt_url)
                
                if "UPDATE 1" in result:
                    logging.info(f"  [UPDATED] Set notes_url for {pathname}")
                    updates_count += 1
                else:
                    logging.info(f"  [SKIPPED] Already in sync or record not found for {pathname}")

        logging.info(f"Sync complete. Updated {updates_count} records.")

    except Exception as e:
        logging.error(f"An error occurred during sync: {e}", exc_info=True)
    finally:
        await db_pool.disconnect()

if __name__ == "__main__":
    asyncio.run(sync_existing_notes())
