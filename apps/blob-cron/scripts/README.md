# NJMTech Blob Cron - Utility Scripts

This directory contains the essential scripts for running and maintaining the Vercel Blob cron job.

## Scripts Overview

### Core Scripts
*   **`run_cron.sh`**: The main entry point for the cron job. It uses `flock` to prevent overlapping runs and executes `main.py`.

### Maintenance Tools
*   **`final_cleanup_v2.py`**: The definitive cleanup tool. It queries the custom NJMTech API to find existing markdown result URLs and deletes them using the official Vercel API. Use this to reset the state for all transcripts if needed.

## Usage

These scripts should be run from inside the Docker container to ensure all dependencies and environment variables are present.

Example:
```bash
docker exec -e PYTHONPATH=src njmtech-blob-cron-cron-service-1 python3 scripts/final_cleanup_v2.py
```
