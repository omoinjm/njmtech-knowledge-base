import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "./d1";
import { KnowledgeBase, MediaItem, Platform } from "@/types/media";
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  generateKnowledgeBaseSlug,
  normalizeKnowledgeBaseName,
} from "./knowledge-bases";

const scrypt = promisify(scryptCallback);

/**
 * Database row shape for the media_items table.
 * `tags` is stored as a JSON-serialized string (D1/SQLite has no native
 * array type) and parsed back into string[] in rowToItem().
 */
interface DbRow {
  id: string;
  knowledge_base_id: string;
  url: string;
  platform: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  author_name: string | null;
  transcript_url: string | null;
  notes_url: string | null;
  category: string | null;
  tags: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface KnowledgeBaseRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

/**
 * Database row shape for the personal_access_keys table.
 */
interface AccessKeyRow {
  slot: string;
  salt: string;
  key_hash: string;
}

let _schemaReady: Promise<void> | null = null;

/**
 * Maps a knowledge base database row into the UI shape.
 */
function rowToKnowledgeBase(row: KnowledgeBaseRow): KnowledgeBase {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at).toISOString().slice(0, 10),
  };
}

async function getOrCreateDefaultKnowledgeBase(): Promise<KnowledgeBase> {
  const existing = await sql<KnowledgeBaseRow>`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    WHERE slug = ${DEFAULT_KNOWLEDGE_BASE_SLUG}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return rowToKnowledgeBase(existing[0]);
  }

  const now = new Date().toISOString();
  const rows = await sql<KnowledgeBaseRow>`
    INSERT INTO knowledge_bases (id, name, slug, created_at, updated_at)
    VALUES (${randomUUID()}, ${DEFAULT_KNOWLEDGE_BASE_NAME}, ${DEFAULT_KNOWLEDGE_BASE_SLUG}, ${now}, ${now})
    RETURNING id, name, slug, created_at
  `;

  return rowToKnowledgeBase(rows[0]);
}

/**
 * Ensures all tables exist. Fresh D1 database, so this is just the final
 * schema shape applied idempotently — no incremental migrations needed
 * (unlike the old Postgres/Neon schema, which accreted ALTER TABLE steps
 * over time).
 */
async function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS knowledge_bases (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS media_items (
          id TEXT PRIMARY KEY,
          knowledge_base_id TEXT NOT NULL,
          url TEXT NOT NULL,
          platform TEXT NOT NULL,
          video_id TEXT NOT NULL,
          title TEXT NOT NULL,
          thumbnail_url TEXT,
          author_name TEXT,
          transcript_url TEXT,
          notes_url TEXT,
          category TEXT,
          tags TEXT,
          created_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS media_items_knowledge_base_url_idx
        ON media_items (knowledge_base_id, url)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS personal_access_keys (
          slot TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `;

      await getOrCreateDefaultKnowledgeBase();
    })();
  }
  return _schemaReady;
}

/**
 * Hashes a personal access key using scrypt.
 *
 * @param key - The raw access key string
 * @param salt - Optional salt (generates a new one if omitted)
 * @returns The salt and resulting hash
 */
async function hashPersonalAccessKey(key: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(key, salt, 64)) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

/**
 * Transforms a raw database row into a structured MediaItem object.
 *
 * @param r - The database row
 * @returns Formatted MediaItem
 */
function rowToItem(r: DbRow): MediaItem {
  return {
    id: r.id,
    knowledgeBaseId: r.knowledge_base_id,
    url: r.url,
    platform: r.platform as Platform,
    videoId: r.video_id,
    title: r.title,
    thumbnailUrl: r.thumbnail_url,
    authorName: r.author_name,
    transcriptUrl: r.transcript_url,
    notesUrl: r.notes_url,
    category: r.category ?? null,
    tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
  };
}

async function getKnowledgeBaseByIdInternal(id: string): Promise<KnowledgeBase | null> {
  const rows = await sql<KnowledgeBaseRow>`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  return rowToKnowledgeBase(rows[0]);
}

export async function dbGetDefaultKnowledgeBase(): Promise<KnowledgeBase> {
  await ensureSchema();
  return getOrCreateDefaultKnowledgeBase();
}

export async function dbGetKnowledgeBaseById(id: string): Promise<KnowledgeBase | null> {
  await ensureSchema();
  return getKnowledgeBaseByIdInternal(id);
}

export async function dbGetKnowledgeBases(): Promise<KnowledgeBase[]> {
  await ensureSchema();
  const rows = await sql<KnowledgeBaseRow>`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    ORDER BY created_at ASC
  `;

  if (rows.length === 0) {
    return [await getOrCreateDefaultKnowledgeBase()];
  }

  return rows.map(rowToKnowledgeBase);
}

export async function dbCreateKnowledgeBase(name: string): Promise<KnowledgeBase> {
  await ensureSchema();

  const normalizedName = normalizeKnowledgeBaseName(name);
  const existingRows = await sql<{ slug: string }>`
    SELECT slug
    FROM knowledge_bases
  `;

  const slug = generateKnowledgeBaseSlug(
    normalizedName,
    existingRows.map((row) => row.slug),
  );

  const now = new Date().toISOString();
  const rows = await sql<KnowledgeBaseRow>`
    INSERT INTO knowledge_bases (id, name, slug, created_at, updated_at)
    VALUES (${randomUUID()}, ${normalizedName}, ${slug}, ${now}, ${now})
    RETURNING id, name, slug, created_at
  `;

  return rowToKnowledgeBase(rows[0]);
}

/**
 * Retrieves all non-deleted media items from the database.
 *
 * @returns Array of media items, sorted by creation date (desc)
 */
export async function dbGetMediaItems(knowledgeBaseId: string): Promise<MediaItem[]> {
  await ensureSchema();
  const rows = await sql<DbRow>`
    SELECT id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name,
           transcript_url, notes_url, category, tags, created_at, deleted_at
    FROM media_items
    WHERE knowledge_base_id = ${knowledgeBaseId} AND deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  return rows.map(rowToItem);
}

/**
 * Retrieves a single media item by its original URL.
 *
 * @param url - The URL to search for
 * @returns The media item if found, otherwise null
 */
export async function dbGetByUrl(url: string, knowledgeBaseId: string): Promise<MediaItem | null> {
  await ensureSchema();
  const rows = await sql<DbRow>`
    SELECT * FROM media_items
    WHERE knowledge_base_id = ${knowledgeBaseId} AND url = ${url} AND deleted_at IS NULL
  `;
  if (rows.length === 0) return null;
  return rowToItem(rows[0]);
}

/**
 * Retrieves a single media item by its unique ID.
 *
 * @param id - The UUID of the media item
 * @returns The media item if found, otherwise null
 */
export async function dbGetById(id: string): Promise<MediaItem | null> {
  await ensureSchema();
  const rows = await sql<DbRow>`
    SELECT * FROM media_items
    WHERE id = ${id} AND deleted_at IS NULL
  `;
  if (rows.length === 0) return null;
  return rowToItem(rows[0]);
}

/**
 * Upserts a media item into the database.
 * If the URL exists, updates the record and clears deleted_at.
 *
 * @param item - Partial media item data for insertion/update
 * @returns The updated or newly created media item
 */
export async function dbUpsertMediaItem(item: {
  knowledgeBaseId: string;
  url: string;
  platform: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  transcriptUrl: string | null;
  notesUrl: string | null;
}): Promise<MediaItem> {
  await ensureSchema();
  const now = new Date().toISOString();
  const rows = await sql<DbRow>`
    INSERT INTO media_items (id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name, transcript_url, notes_url, created_at)
    VALUES (${randomUUID()}, ${item.knowledgeBaseId}, ${item.url}, ${item.platform}, ${item.videoId}, ${item.title},
            ${item.thumbnailUrl}, ${item.authorName}, ${item.transcriptUrl}, ${item.notesUrl}, ${now})
    ON CONFLICT (knowledge_base_id, url) DO UPDATE SET
      platform       = excluded.platform,
      video_id       = excluded.video_id,
      title          = excluded.title,
      thumbnail_url  = excluded.thumbnail_url,
      author_name    = excluded.author_name,
      transcript_url = excluded.transcript_url,
      notes_url      = excluded.notes_url,
      deleted_at     = NULL
    RETURNING *
  `;
  return rowToItem(rows[0]);
}

/**
 * Updates the categorization metadata for a media item.
 *
 * @param id - The ID of the item to update
 * @param category - The primary category name
 * @param tags - List of topic tags
 * @param title - Optional proposed title update
 */
export async function dbUpdateCategory(
  id: string,
  category: string,
  tags: string[],
  title?: string
): Promise<void> {
  await ensureSchema();
  const serializedTags = JSON.stringify(tags);
  if (title) {
    await sql`
      UPDATE media_items
      SET category = ${category}, tags = ${serializedTags}, title = ${title}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE media_items
      SET category = ${category}, tags = ${serializedTags}
      WHERE id = ${id}
    `;
  }
}

/**
 * Performs a soft delete on a media item by setting its deleted_at timestamp.
 *
 * @param id - The ID of the item to delete
 * @returns True if an item was successfully marked as deleted
 */
export async function dbSoftDeleteMediaItem(id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql<{ id: string }>`
    UPDATE media_items
    SET deleted_at = ${new Date().toISOString()}
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Checks if a primary personal access key has been configured.
 *
 * @returns True if a key exists in the 'primary' slot
 */
export async function dbHasPersonalAccessKey(): Promise<boolean> {
  await ensureSchema();
  const rows = await sql<{ slot: string }>`
    SELECT slot FROM personal_access_keys
    WHERE slot = 'primary'
  `;
  return rows.length > 0;
}

/**
 * Sets up the primary personal access key.
 * Fails if a key is already configured.
 *
 * @param key - The raw access key string to configure
 * @returns True if the key was successfully created
 */
export async function dbCreatePersonalAccessKey(key: string): Promise<boolean> {
  await ensureSchema();
  const exists = await dbHasPersonalAccessKey();
  if (exists) return false;

  const { salt, hash } = await hashPersonalAccessKey(key);
  const now = new Date().toISOString();
  await sql`
    INSERT INTO personal_access_keys (slot, salt, key_hash, created_at, updated_at)
    VALUES ('primary', ${salt}, ${hash}, ${now}, ${now})
  `;
  return true;
}

/**
 * Verifies a raw key against the stored primary access key hash.
 *
 * @param key - The raw key string to verify
 * @returns True if the key matches the stored hash
 */
export async function dbVerifyPersonalAccessKey(key: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql<AccessKeyRow>`
    SELECT salt, key_hash
    FROM personal_access_keys
    WHERE slot = 'primary'
  `;

  if (rows.length === 0) return false;

  const row = rows[0];
  const storedHash = Buffer.from(row.key_hash, "hex");
  const derivedHash = (await scrypt(key, row.salt, storedHash.length)) as Buffer;
  return timingSafeEqual(storedHash, derivedHash);
}
