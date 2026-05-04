import asyncio
import json
import logging
import os
import urllib.request
from njm_blob_cron.config import validate_config
from njm_blob_cron.blob_storage.vercel_blob import BlobAPIStorage
from njm_blob_cron.processing.markdown_transformer import MarkdownTransformer
from njm_blob_cron.scanner.directory_scanner import DirectoryScanner
from njm_blob_cron.database import db_pool

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def report_job_status(status: str, message: str = "") -> None:
    """Send job result to the Worker callback URL (stored in Durable Object storage)."""
    callback_url = os.environ.get("JOB_CALLBACK_URL")
    callback_token = os.environ.get("JOB_CALLBACK_TOKEN")
    if not callback_url or not callback_token:
        return
    try:
        payload = json.dumps({"status": status, "message": message}).encode()
        req = urllib.request.Request(
            callback_url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {callback_token}",
            },
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as exc:
        logging.warning(f"Failed to report job status: {exc}")


async def main():
    """
    Main coroutine to run the blob cron job.
    
    This function initializes all the components of the application,
    wires them together, and starts the asynchronous scanning process.
    """
    logging.info("Starting NJMTech Blob Cron job...")

    try:
        # 1. Validate configuration
        validate_config()
        logging.info("Configuration validated successfully.")

        # 2. Instantiate components (Dependency Injection)
        blob_storage = BlobAPIStorage()
        markdown_processor = MarkdownTransformer(blob_storage=blob_storage)
        scanner = DirectoryScanner(
            blob_storage=blob_storage,
            file_processor=markdown_processor
        )

        # 3. Run the main async logic
        await scanner.scan_and_process()
        report_job_status("success")

    except ValueError as e:
        logging.error(f"Configuration error: {e}")
        report_job_status("error", f"Configuration error: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}", exc_info=True)
        report_job_status("error", str(e))
    finally:
        await db_pool.disconnect()
    
    logging.info("NJMTech Blob Cron job finished.")

if __name__ == "__main__":
    asyncio.run(main())
