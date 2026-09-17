#!/usr/bin/env node
/**
 * One-off migration: copies all rows from the retired Neon/Postgres database
 * into the new Cloudflare D1 database. The CLOUDFLARE_* D1 creds are read
 * from Infisical's "prod" environment. POSTGRES_URL is read from the process
 * environment first (see run-migration.sh) and only falls back to Infisical
 * prod if not already set there — it was wiped from Infisical when the D1
 * creds got copied over, so run-migration.sh is the normal path now.
 *
 * Safe to re-run: media_items uses INSERT OR REPLACE keyed on the original
 * row id, personal_access_keys uses INSERT OR IGNORE so it never clobbers a
 * key already configured directly against D1 (e.g. a fresh prod key set up
 * after the migration ran).
 *
 * Usage: node scripts/migrate-postgres-to-d1.mjs
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import https from "node:https";
import { InfisicalSDK } from "@infisical/sdk";
import { neon, neonConfig } from "@neondatabase/serverless";

// Same workaround as the old src/lib/db.ts: undici (fetch) doesn't fall back
// from IPv6 to IPv4, and the Neon pooler host is unreachable over IPv6 here.
neonConfig.fetchFunction = async (url, init) => {
  const urlObj = new URL(typeof url === "string" ? url : url.toString());
  const [ip] = await resolve4(urlObj.hostname);

  return new Promise((resolvePromise, reject) => {
    const req = https.request(
      {
        host: ip,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: init?.method ?? "POST",
        headers: { ...init?.headers, Host: urlObj.hostname },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolvePromise(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 200, headers: res.headers }))
        );
      }
    );
    req.on("error", reject);
    if (init?.body) req.write(init.body);
    req.end();
  });
};

const DEFAULT_KNOWLEDGE_BASE_NAME = "General";
const DEFAULT_KNOWLEDGE_BASE_SLUG = "general";

function loadBootstrapEnv(path) {
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function fetchSecrets(client, projectId, environment) {
  const secrets = await client.secrets().listSecretsWithImports({
    environment,
    projectId,
    expandSecretReferences: true,
  });
  return Object.fromEntries(secrets.map((s) => [s.secretKey, s.secretValue]));
}

async function d1Query(accountId, databaseId, token, sqlText, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: sqlText, params }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    const message = data.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`D1 query failed: ${message}\nSQL: ${sqlText}`);
  }
  return data.result[0]?.results ?? [];
}

function toIso(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

async function main() {
  const bootstrap = loadBootstrapEnv(new URL("../apps/media/.env.production.local", import.meta.url));
  const infisical = new InfisicalSDK(
    bootstrap.INFISICAL_SITE_URL ? { siteUrl: bootstrap.INFISICAL_SITE_URL } : {}
  );
  await infisical.auth().universalAuth.login({
    clientId: bootstrap.INFISICAL_CLIENT_ID,
    clientSecret: bootstrap.INFISICAL_CLIENT_SECRET,
  });

  console.log("Fetching destination secrets from Infisical (prod)...");
  const prodSecrets = await fetchSecrets(infisical, bootstrap.INFISICAL_PROJECT_ID, "prod");

  const postgresUrl = process.env.POSTGRES_URL || prodSecrets.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL not set. Fill it in via scripts/run-migration.sh (it's not in Infisical anymore)."
    );
  }

  const accountId = prodSecrets.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = prodSecrets.CLOUDFLARE_D1_DATABASE_ID;
  const d1Token = prodSecrets.CLOUDFLARE_D1_API_TOKEN;
  if (!accountId || !databaseId || !d1Token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_D1_API_TOKEN not found in Infisical prod environment.");
  }

  console.log("Connecting to source Postgres database...");
  const pg = neon(postgresUrl);
  const pgMediaItems = await pg`
    SELECT id, url, platform, video_id, title, thumbnail_url, author_name,
           transcript_url, notes_url, category, tags, created_at, deleted_at
    FROM media_items
  `;
  const pgAccessKeys = await pg`
    SELECT slot, salt, key_hash, created_at, updated_at FROM personal_access_keys
  `;
  console.log(`Source: ${pgMediaItems.length} media_items row(s), ${pgAccessKeys.length} personal_access_keys row(s).`);

  console.log("Ensuring destination D1 schema exists...");
  await d1Query(accountId, databaseId, d1Token, `
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await d1Query(accountId, databaseId, d1Token, `
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
  `);
  await d1Query(accountId, databaseId, d1Token, `
    CREATE UNIQUE INDEX IF NOT EXISTS media_items_knowledge_base_url_idx
    ON media_items (knowledge_base_id, url)
  `);
  await d1Query(accountId, databaseId, d1Token, `
    CREATE TABLE IF NOT EXISTS personal_access_keys (
      slot TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  console.log(`Getting or creating the "${DEFAULT_KNOWLEDGE_BASE_SLUG}" knowledge base in D1...`);
  const existingKb = await d1Query(accountId, databaseId, d1Token,
    `SELECT id FROM knowledge_bases WHERE slug = ? LIMIT 1`,
    [DEFAULT_KNOWLEDGE_BASE_SLUG]
  );
  let knowledgeBaseId;
  if (existingKb.length > 0) {
    knowledgeBaseId = existingKb[0].id;
  } else {
    knowledgeBaseId = randomUUID();
    const now = new Date().toISOString();
    await d1Query(accountId, databaseId, d1Token,
      `INSERT INTO knowledge_bases (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [knowledgeBaseId, DEFAULT_KNOWLEDGE_BASE_NAME, DEFAULT_KNOWLEDGE_BASE_SLUG, now, now]
    );
  }
  console.log(`Using knowledge_base_id = ${knowledgeBaseId}`);

  console.log("Migrating media_items...");
  let migratedItems = 0;
  for (const row of pgMediaItems) {
    const tags = row.tags ? JSON.stringify(row.tags) : null;
    await d1Query(accountId, databaseId, d1Token,
      `INSERT OR REPLACE INTO media_items
        (id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name,
         transcript_url, notes_url, category, tags, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        knowledgeBaseId,
        row.url,
        row.platform,
        row.video_id,
        row.title,
        row.thumbnail_url,
        row.author_name,
        row.transcript_url,
        row.notes_url,
        row.category,
        tags,
        toIso(row.created_at),
        toIso(row.deleted_at),
      ]
    );
    migratedItems++;
  }
  console.log(`Migrated ${migratedItems} media_items row(s).`);

  console.log("Migrating personal_access_keys (will not overwrite an existing key)...");
  let migratedKeys = 0;
  for (const row of pgAccessKeys) {
    const result = await d1Query(accountId, databaseId, d1Token,
      `INSERT OR IGNORE INTO personal_access_keys (slot, salt, key_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.slot, row.salt, row.key_hash, toIso(row.created_at), toIso(row.updated_at)]
    );
    migratedKeys++;
  }
  console.log(`Processed ${migratedKeys} personal_access_keys row(s) (ignored if slot already existed).`);

  console.log("\nDone.");
  console.log(`Summary: ${migratedItems} media item(s) -> knowledge_base_id ${knowledgeBaseId}; ${migratedKeys} access key row(s) processed.`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  if (err.cause) console.error("Cause:", err.cause);
  process.exit(1);
});
