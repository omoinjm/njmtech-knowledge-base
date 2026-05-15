import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { neon, neonConfig } from "@neondatabase/serverless";
import { KnowledgeBase, MediaItem, Platform } from "@/types/media";
import { env } from "./env";
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  generateKnowledgeBaseSlug,
  normalizeKnowledgeBaseName,
} from "./knowledge-bases";

const scrypt = promisify(scryptCallback);

// In local dev, Node.js undici (used by fetch) doesn't fall back from IPv6 to IPv4.
// Use the native https module directly to force IPv4 resolution.
if (process.env.NODE_ENV === "development") {
  const dns = require("node:dns/promises") as typeof import("node:dns/promises");
  const https = require("node:https") as typeof import("node:https");

  neonConfig.fetchFunction = async (
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr =
      typeof url === "string"
        ? url
        : url instanceof URL
          ? url.toString()
          : (url as Request).url;
    const urlObj = new URL(urlStr);
    const [ip] = await dns.resolve4(urlObj.hostname);

    return new Promise<Response>((resolve, reject) => {
      const req = https.request(
        {
          host: ip,
          port: 443,
          path: urlObj.pathname + urlObj.search,
          method: (init?.method ?? "POST") as string,
          headers: {
            ...(init?.headers as Record<string, string>),
            Host: urlObj.hostname,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode ?? 200,
                headers: res.headers as Record<string, string>,
              })
            )
          );
        }
      );
      req.on("error", reject);
      if (init?.body) req.write(init.body as string | Uint8Array);
      req.end();
    });
  };
}

/**
 * Database row shape for the media_items table.
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
  tags: string[] | null;
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

// Lazily initialised so the module can be evaluated before instrumentation.ts
// has injected POSTGRES_URL from Infisical.
let _sql: ReturnType<typeof neon> | null = null;

/**
 * Returns a configured SQL client instance.
 * Lazily initialises the client on first call.
 *
 * @returns Neon SQL client
 * @throws {Error} If POSTGRES_URL environment variable is missing
 */
function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    const url = env.databaseUrl;
    if (!url) throw new Error("Database connection URL is not configured. Please set POSTGRES_URL or DATABASE_URL.");
    _sql = neon(url);
  }
  return _sql;
}

let _knowledgeBaseSchemaReady: Promise<void> | null = null;
let _mediaItemsSchemaReady: Promise<void> | null = null;
let _personalAccessSchemaReady: Promise<void> | null = null;

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
  const existing = await getSql()`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    WHERE slug = ${DEFAULT_KNOWLEDGE_BASE_SLUG}
    LIMIT 1
  ` as KnowledgeBaseRow[];

  if (existing.length > 0) {
    return rowToKnowledgeBase(existing[0]);
  }

  const rows = await getSql()`
    INSERT INTO knowledge_bases (id, name, slug)
    VALUES (${randomUUID()}, ${DEFAULT_KNOWLEDGE_BASE_NAME}, ${DEFAULT_KNOWLEDGE_BASE_SLUG})
    RETURNING id, name, slug, created_at
  ` as KnowledgeBaseRow[];

  return rowToKnowledgeBase(rows[0]);
}

/**
 * Ensures the knowledge_bases table exists and that media_items can reference it.
 */
async function ensureKnowledgeBaseSchema(): Promise<void> {
  if (!_knowledgeBaseSchemaReady) {
    _knowledgeBaseSchemaReady = (async () => {
      await getSql()`
        CREATE TABLE IF NOT EXISTS knowledge_bases (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await getSql()`
        ALTER TABLE media_items
        ADD COLUMN IF NOT EXISTS knowledge_base_id TEXT
      `;

      await getSql()`
        DO $$
        DECLARE
          constraint_name TEXT;
          index_name TEXT;
        BEGIN
          SELECT c.conname
          INTO constraint_name
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'media_items'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE (url)';

          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE media_items DROP CONSTRAINT %I', constraint_name);
          END IF;

          SELECT indexname
          INTO index_name
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'media_items'
            AND indexdef LIKE 'CREATE UNIQUE INDEX % ON % (url)%'
          LIMIT 1;

          IF index_name IS NOT NULL THEN
            EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
          END IF;
        END $$;
      `;

      const defaultKnowledgeBase = await getOrCreateDefaultKnowledgeBase();

      await getSql()`
        UPDATE media_items
        SET knowledge_base_id = ${defaultKnowledgeBase.id}
        WHERE knowledge_base_id IS NULL
      `;

      await getSql()`
        CREATE UNIQUE INDEX IF NOT EXISTS media_items_knowledge_base_url_idx
        ON media_items (knowledge_base_id, url)
      `;
    })();
  }
  return _knowledgeBaseSchemaReady;
}

/**
 * Ensures the media_items table schema is up to date.
 */
async function ensureMediaItemsSchema(): Promise<void> {
  if (!_mediaItemsSchemaReady) {
    _mediaItemsSchemaReady = (async () => {
      await ensureKnowledgeBaseSchema();
      await getSql()`
        ALTER TABLE media_items
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
      `;
    })();
  }
  return _mediaItemsSchemaReady;
}

/**
 * Ensures the personal_access_keys table exists.
 */
async function ensurePersonalAccessSchema(): Promise<void> {
  if (!_personalAccessSchemaReady) {
    _personalAccessSchemaReady = (async () => {
      await getSql()`
        CREATE TABLE IF NOT EXISTS personal_access_keys (
          slot TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })();
  }
  return _personalAccessSchemaReady;
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
    tags: r.tags ?? [],
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
  };
}

async function getKnowledgeBaseByIdInternal(id: string): Promise<KnowledgeBase | null> {
  const rows = await getSql()`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    WHERE id = ${id}
    LIMIT 1
  ` as KnowledgeBaseRow[];

  if (rows.length === 0) {
    return null;
  }

  return rowToKnowledgeBase(rows[0]);
}

export async function dbGetDefaultKnowledgeBase(): Promise<KnowledgeBase> {
  await ensureKnowledgeBaseSchema();
  return getOrCreateDefaultKnowledgeBase();
}

export async function dbGetKnowledgeBaseById(id: string): Promise<KnowledgeBase | null> {
  await ensureKnowledgeBaseSchema();
  return getKnowledgeBaseByIdInternal(id);
}

export async function dbGetKnowledgeBases(): Promise<KnowledgeBase[]> {
  await ensureKnowledgeBaseSchema();
  const rows = await getSql()`
    SELECT id, name, slug, created_at
    FROM knowledge_bases
    ORDER BY created_at ASC
  ` as KnowledgeBaseRow[];

  if (rows.length === 0) {
    return [await getOrCreateDefaultKnowledgeBase()];
  }

  return rows.map(rowToKnowledgeBase);
}

export async function dbCreateKnowledgeBase(name: string): Promise<KnowledgeBase> {
  await ensureKnowledgeBaseSchema();

  const normalizedName = normalizeKnowledgeBaseName(name);
  const existingRows = await getSql()`
    SELECT slug
    FROM knowledge_bases
  ` as Array<{ slug: string }>;

  const slug = generateKnowledgeBaseSlug(
    normalizedName,
    existingRows.map((row) => row.slug),
  );

  const rows = await getSql()`
    INSERT INTO knowledge_bases (id, name, slug)
    VALUES (${randomUUID()}, ${normalizedName}, ${slug})
    RETURNING id, name, slug, created_at
  ` as KnowledgeBaseRow[];

  return rowToKnowledgeBase(rows[0]);
}

/**
 * Retrieves all non-deleted media items from the database.
 *
 * @returns Array of media items, sorted by creation date (desc)
 */
export async function dbGetMediaItems(knowledgeBaseId: string): Promise<MediaItem[]> {
  await ensureMediaItemsSchema();
  const rows = await getSql()`
    SELECT id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name,
           transcript_url, notes_url, category, tags, created_at, deleted_at
    FROM media_items
    WHERE knowledge_base_id = ${knowledgeBaseId} AND deleted_at IS NULL
    ORDER BY created_at DESC
  ` as DbRow[];
  return rows.map(rowToItem);
}

/**
 * Retrieves a single media item by its original URL.
 *
 * @param url - The URL to search for
 * @returns The media item if found, otherwise null
 */
export async function dbGetByUrl(url: string, knowledgeBaseId: string): Promise<MediaItem | null> {
  await ensureMediaItemsSchema();
  const rows = await getSql()`
    SELECT * FROM media_items
    WHERE knowledge_base_id = ${knowledgeBaseId} AND url = ${url} AND deleted_at IS NULL
  ` as DbRow[];
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
  await ensureMediaItemsSchema();
  const rows = await getSql()`
    SELECT * FROM media_items
    WHERE id = ${id} AND deleted_at IS NULL
  ` as DbRow[];
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
  await ensureMediaItemsSchema();
  const rows = await getSql()`
    INSERT INTO media_items (knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name, transcript_url, notes_url)
    VALUES (${item.knowledgeBaseId}, ${item.url}, ${item.platform}, ${item.videoId}, ${item.title},
            ${item.thumbnailUrl}, ${item.authorName}, ${item.transcriptUrl}, ${item.notesUrl})
    ON CONFLICT (knowledge_base_id, url) DO UPDATE SET
      platform       = EXCLUDED.platform,
      video_id       = EXCLUDED.video_id,
      title          = EXCLUDED.title,
      thumbnail_url  = EXCLUDED.thumbnail_url,
      author_name    = EXCLUDED.author_name,
      transcript_url = EXCLUDED.transcript_url,
      notes_url      = EXCLUDED.notes_url,
      deleted_at     = NULL
    RETURNING *
  ` as DbRow[];
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
  await ensureMediaItemsSchema();
  if (title) {
    await getSql()`
      UPDATE media_items 
      SET category = ${category}, tags = ${tags}, title = ${title} 
      WHERE id = ${id}
    `;
  } else {
    await getSql()`
      UPDATE media_items 
      SET category = ${category}, tags = ${tags} 
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
  await ensureMediaItemsSchema();
  const rows = await getSql()`
    UPDATE media_items
    SET deleted_at = NOW()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

/**
 * Checks if a primary personal access key has been configured.
 *
 * @returns True if a key exists in the 'primary' slot
 */
export async function dbHasPersonalAccessKey(): Promise<boolean> {
  await ensurePersonalAccessSchema();
  const rows = await getSql()`
    SELECT slot FROM personal_access_keys
    WHERE slot = 'primary'
  ` as Array<{ slot: string }>;
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
  await ensurePersonalAccessSchema();
  const exists = await dbHasPersonalAccessKey();
  if (exists) return false;

  const { salt, hash } = await hashPersonalAccessKey(key);
  await getSql()`
    INSERT INTO personal_access_keys (slot, salt, key_hash)
    VALUES ('primary', ${salt}, ${hash})
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
  await ensurePersonalAccessSchema();
  const rows = await getSql()`
    SELECT salt, key_hash
    FROM personal_access_keys
    WHERE slot = 'primary'
  ` as AccessKeyRow[];

  if (rows.length === 0) return false;

  const row = rows[0];
  const storedHash = Buffer.from(row.key_hash, "hex");
  const derivedHash = (await scrypt(key, row.salt, storedHash.length)) as Buffer;
  return timingSafeEqual(storedHash, derivedHash);
}
