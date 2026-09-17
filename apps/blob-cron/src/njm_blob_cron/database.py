import logging
import httpx
from njm_blob_cron.config import (
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_D1_DATABASE_ID,
    CLOUDFLARE_D1_API_TOKEN,
)


class DatabasePool:
    """
    Runs SQL statements against the njmtech-media Cloudflare D1 database via
    its REST API. blob-cron is a plain Python batch job, not a Cloudflare
    Worker, so it has no native D1 binding and talks to D1 over HTTPS
    instead — the same approach apps/media and apps/yt-transcribe use.
    """
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def connect(self):
        """Initializes the HTTP client."""
        if not self._client:
            self._client = httpx.AsyncClient(timeout=30.0)
            logging.info("D1 HTTP client initialized.")

    async def disconnect(self):
        """Closes the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
            logging.info("D1 HTTP client closed.")

    async def _query(self, query: str, params: list):
        if not self._client:
            await self.connect()

        url = (
            f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}"
            f"/d1/database/{CLOUDFLARE_D1_DATABASE_ID}/query"
        )
        response = await self._client.post(
            url,
            json={"sql": query, "params": params},
            headers={"Authorization": f"Bearer {CLOUDFLARE_D1_API_TOKEN}"},
        )
        data = response.json()

        if response.status_code != 200 or not data.get("success"):
            errors = data.get("errors") or []
            message = "; ".join(e.get("message", "") for e in errors) or f"HTTP {response.status_code}"
            raise RuntimeError(f"D1 query failed: {message}\nSQL: {query}")

        result = (data.get("result") or [{}])[0]
        return result

    async def execute(self, query: str, *args):
        """Executes a mutating SQL statement. Returns the number of rows changed."""
        result = await self._query(query, list(args))
        meta = result.get("meta") or {}
        return meta.get("changes", 0)

    async def fetch(self, query: str, *args):
        """Fetches rows from the database."""
        result = await self._query(query, list(args))
        return result.get("results") or []

# Singleton-like instance
db_pool = DatabasePool()
