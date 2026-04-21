import asyncpg
from njm_blob_cron.config import POSTGRES_URL
import logging

class DatabasePool:
    """
    Manages a PostgreSQL connection pool using asyncpg.
    """
    def __init__(self):
        self.pool = None

    async def connect(self):
        """Initializes the connection pool."""
        if not self.pool:
            try:
                self.pool = await asyncpg.create_pool(dsn=POSTGRES_URL)
                logging.info("PostgreSQL connection pool established.")
            except Exception as e:
                logging.error(f"Failed to create database pool: {e}")
                raise

    async def disconnect(self):
        """Closes the connection pool."""
        if self.pool:
            await self.pool.close()
            logging.info("PostgreSQL connection pool closed.")

    async def execute(self, query: str, *args):
        """Executes a SQL query."""
        if not self.pool:
            await self.connect()
        async with self.pool.acquire() as connection:
            return await connection.execute(query, *args)

    async def fetch(self, query: str, *args):
        """Fetches rows from the database."""
        if not self.pool:
            await self.connect()
        async with self.pool.acquire() as connection:
            return await connection.fetch(query, *args)

# Singleton-like instance
db_pool = DatabasePool()
