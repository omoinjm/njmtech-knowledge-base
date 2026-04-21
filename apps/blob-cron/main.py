import asyncio
import logging
from njm_blob_cron.config import validate_config
from njm_blob_cron.blob_storage.vercel_blob import VercelBlobStorage
from njm_blob_cron.processing.markdown_transformer import MarkdownTransformer
from njm_blob_cron.scanner.directory_scanner import DirectoryScanner
from njm_blob_cron.database import db_pool

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
        blob_storage = VercelBlobStorage()
        markdown_processor = MarkdownTransformer(blob_storage=blob_storage)
        scanner = DirectoryScanner(
            blob_storage=blob_storage,
            file_processor=markdown_processor
        )

        # 3. Run the main async logic
        await scanner.scan_and_process()

    except ValueError as e:
        logging.error(f"Configuration error: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}", exc_info=True)
    finally:
        await db_pool.disconnect()
    
    logging.info("NJMTech Blob Cron job finished.")

if __name__ == "__main__":
    asyncio.run(main())
