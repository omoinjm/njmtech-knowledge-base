/**
 * Type-safe environment variable access.
 * Throws at startup if a required variable is missing.
 */
/**
 * Type-safe environment variable access.
 * Throws at startup if a required variable is missing.
 */
function requireEnv(key: string, options?: { fallbackKey?: string; optional?: boolean }): string {
  const { fallbackKey, optional = false } = options ?? {};
  const value = process.env[key] || (fallbackKey ? process.env[fallbackKey] : undefined);
  
  if (!value) {
    if (optional) return "";

    // Only throw in server-side context to avoid crashing the build during static generation.
    if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
      const msg = fallbackKey 
        ? `Missing required environment variable: ${key} or ${fallbackKey}`
        : `Missing required environment variable: ${key}`;
      throw new Error(msg);
    }
    return "";
  }
  return value;
}

/**
 * Validated environment configuration.
 * All variables exported here are guaranteed to exist at the time of access (unless marked optional).
 */
export const env = {
  /** GitHub personal access token for AI Models API (Fetched from Infisical in dev) */
  get githubToken() { return requireEnv("GITHUB_TOKEN", { optional: true }); },
  /**
   * Cloudflare account ID that owns the D1 database.
   * Optional: when any of the three CLOUDFLARE_D1_* vars are unset, `./d1`
   * falls back to a local SQLite replica on disk (see `localD1Path`) instead
   * of calling the remote D1 REST API — this is the dev-without-cloud path.
   */
  get cloudflareAccountId() { return requireEnv("CLOUDFLARE_ACCOUNT_ID", { optional: true }); },
  /** D1 database ID (njmtech-media) */
  get cloudflareD1DatabaseId() { return requireEnv("CLOUDFLARE_D1_DATABASE_ID", { optional: true }); },
  /** Cloudflare API token scoped to D1 edit, used to call the D1 REST API */
  get cloudflareD1ApiToken() { return requireEnv("CLOUDFLARE_D1_API_TOKEN", { optional: true }); },
  /** Path to the local SQLite replica used when no CLOUDFLARE_D1_* vars are set */
  get localD1Path() { return requireEnv("LOCAL_D1_PATH", { optional: true }) || ".data/local-d1.sqlite"; },
  /** Upload-blob API base URL for object storage lookups */
  get uploadBlobApiUrl() { return process.env.UPLOAD_BLOB_API_URL || process.env.BLOB_API_URL || "https://api.blob.njmtech.co.za"; },
  /** Bearer token for the upload-blob API */
  get uploadBlobApiToken() { return requireEnv("UPLOAD_BLOB_API_TOKEN", { optional: true }); },
} as const;
