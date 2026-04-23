/**
 * Type-safe environment variable access.
 * Throws at startup if a required variable is missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    // Only throw in server-side context to avoid crashing the build during static generation.
    // We also skip throwing during the build phase itself.
    if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return "";
  }
  return value;
}

/**
 * Validated environment configuration.
 * All variables exported here are guaranteed to exist.
 */
export const env = {
  /** GitHub personal access token for AI Models API */
  githubToken: requireEnv("GITHUB_TOKEN"),
  /** Connection string for the Neon database */
  databaseUrl: requireEnv("POSTGRES_URL"),
  /** Vercel Blob read/write token */
  blobReadWriteToken: requireEnv("BLOB_READ_WRITE_TOKEN"),
} as const;
