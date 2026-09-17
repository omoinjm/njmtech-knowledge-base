import path from "node:path";
import { mkdirSync } from "node:fs";
import { env } from "./env";

interface D1QueryResult {
  results: Record<string, unknown>[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1ApiResponse {
  result: D1QueryResult[];
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: unknown[];
}

let _localDb: any = null;

/**
 * Lazily opens the local SQLite replica used for dev when no CLOUDFLARE_D1_*
 * vars are configured. Node's built-in `node:sqlite` (stable from Node 22+)
 * speaks the same SQLite dialect as D1, so the exact same `?`-parameterized
 * SQL text and RETURNING clauses used against the remote API work here too.
 */
async function getLocalDb(): Promise<any> {
  if (!_localDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const dbPath = path.resolve(process.cwd(), env.localD1Path);
    mkdirSync(path.dirname(dbPath), { recursive: true });
    _localDb = new DatabaseSync(dbPath);
  }
  return _localDb;
}

function isRemoteD1Configured(): boolean {
  return Boolean(env.cloudflareAccountId && env.cloudflareD1DatabaseId && env.cloudflareD1ApiToken);
}

async function executeLocal(sqlText: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const db = await getLocalDb();
  return db.prepare(sqlText).all(...params) as Record<string, unknown>[];
}

/**
 * Runs a single SQL statement against the njmtech-media D1 database via
 * Cloudflare's REST API. media runs as a plain Node/Docker container (not a
 * Cloudflare Worker), so it has no native D1 binding — this is the
 * equivalent of what the Neon HTTP driver did for Postgres.
 *
 * Falls back to a local SQLite replica on disk (see `env.localD1Path`) when
 * no CLOUDFLARE_D1_* vars are configured, so `pnpm dev:local` works fully
 * offline without touching the cloud database.
 */
async function execute(sqlText: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  if (!isRemoteD1Configured()) {
    return await executeLocal(sqlText, params);
  }

  const accountId = env.cloudflareAccountId;
  const databaseId = env.cloudflareD1DatabaseId;
  const token = env.cloudflareD1ApiToken;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: sqlText, params }),
    }
  );

  const data = (await res.json()) as D1ApiResponse;

  if (!res.ok || !data.success) {
    const message = data.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`D1 query failed: ${message}\nSQL: ${sqlText}`);
  }

  return data.result[0]?.results ?? [];
}

/**
 * Tagged-template SQL helper, mirroring the calling convention the Neon
 * driver used (`sql\`SELECT ... WHERE id = ${id}\``) so call sites barely
 * had to change. Interpolated values become `?` placeholders bound as
 * params — never string-concatenated into the query.
 */
export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let sqlText = strings[0];
  const params: unknown[] = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    sqlText += "?" + strings[i + 1];
  }
  return execute(sqlText, params) as Promise<T[]>;
}
