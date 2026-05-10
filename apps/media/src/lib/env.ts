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
  /** Connection string for the Neon database */
  get databaseUrl() { return requireEnv("POSTGRES_URL", { fallbackKey: "DATABASE_URL" }); },
  /** Upload-blob API base URL for object storage lookups */
  get uploadBlobApiUrl() { return process.env.UPLOAD_BLOB_API_URL || process.env.BLOB_API_URL || "https://api.blob.njmtech.co.za"; },
  /** Bearer token for the upload-blob API */
  get uploadBlobApiToken() { return requireEnv("UPLOAD_BLOB_API_TOKEN", { optional: true }); },
} as const;
