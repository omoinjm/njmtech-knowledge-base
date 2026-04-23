import { InfisicalSDK } from "@infisical/sdk";

let initialized = false;

/**
 * Fetches secrets from Infisical and injects them into process.env.
 * Runs once at server startup via src/instrumentation.ts.
 *
 * Required env vars (bootstrap only):
 *   INFISICAL_CLIENT_ID      — Machine Identity client ID
 *   INFISICAL_CLIENT_SECRET  — Machine Identity client secret
 *   INFISICAL_PROJECT_ID     — Infisical project ID
 *
 * Optional:
 *   INFISICAL_ENVIRONMENT    — dev | staging | prod (default: "dev")
 *   INFISICAL_SITE_URL       — self-hosted instance URL (default: https://app.infisical.com)
 *
 * If any bootstrap var is missing, the function is a no-op and the app falls
 * back to whatever is already set in process.env (e.g. .env.local in dev).
 */
export async function loadSecrets(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Only use Infisical SDK in development.
  // In production/staging, secrets are synced directly to the environment via Vercel integration.
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    // No Infisical config — fall back to existing process.env (local dev)
    return;
  }

  const environment = process.env.INFISICAL_ENVIRONMENT ?? "dev";
  const siteUrl = process.env.INFISICAL_SITE_URL;

  try {
    const client = new InfisicalSDK({ ...(siteUrl ? { siteUrl } : {}) });

    await client.auth().universalAuth.login({ clientId, clientSecret });

    const secrets = await client.secrets().listSecretsWithImports({
      environment,
      projectId,
      expandSecretReferences: true,
    });

    let loaded = 0;
    for (const secret of secrets) {
      // Only set if not already overridden locally
      if (process.env[secret.secretKey] === undefined) {
        process.env[secret.secretKey] = secret.secretValue;
        loaded++;
      }
    }

    console.log(
      `[infisical] Loaded ${loaded} secret(s) from "${environment}" environment`
    );
  } catch (err) {
    // Non-fatal — log and continue. The app will fail later if a required
    // secret is truly missing, which gives a clearer error at the usage site.
    console.error("[infisical] Failed to load secrets:", err);
  }
}
