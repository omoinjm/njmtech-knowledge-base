#!/usr/bin/env node
/**
 * Writes CLOUDFLARE_AI_API_TOKEN (read from process.env, see run-migration.sh
 * style wrapper run-ai-token.sh) into Infisical's "prod" environment.
 *
 * Creates the secret if it doesn't exist yet, updates it if it does — safe
 * to re-run (e.g. after rotating the token).
 *
 * Usage: node scripts/write-ai-token-to-infisical.mjs
 */
import { readFileSync } from "node:fs";
import { InfisicalSDK } from "@infisical/sdk";

function loadBootstrapEnv(path) {
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const token = process.env.CLOUDFLARE_AI_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_AI_API_TOKEN not set. Run this via scripts/add-ai-token.sh.");
  }

  const bootstrap = loadBootstrapEnv(new URL("../apps/media/.env.production.local", import.meta.url));
  const infisical = new InfisicalSDK(
    bootstrap.INFISICAL_SITE_URL ? { siteUrl: bootstrap.INFISICAL_SITE_URL } : {}
  );
  await infisical.auth().universalAuth.login({
    clientId: bootstrap.INFISICAL_CLIENT_ID,
    clientSecret: bootstrap.INFISICAL_CLIENT_SECRET,
  });

  const projectId = bootstrap.INFISICAL_PROJECT_ID;
  const environment = "prod";
  const secretName = "CLOUDFLARE_AI_API_TOKEN";

  console.log(`Checking whether ${secretName} already exists in Infisical (${environment})...`);
  const existing = await infisical.secrets().listSecretsWithImports({
    environment,
    projectId,
    expandSecretReferences: false,
  });
  const alreadyExists = existing.some((s) => s.secretKey === secretName);

  if (alreadyExists) {
    console.log(`${secretName} exists — updating it.`);
    await infisical.secrets().updateSecret(secretName, {
      environment,
      projectId,
      secretValue: token,
    });
  } else {
    console.log(`${secretName} does not exist — creating it.`);
    await infisical.secrets().createSecret(secretName, {
      environment,
      projectId,
      secretValue: token,
    });
  }

  console.log(`Done. ${secretName} is now set in Infisical prod (length=${token.length}).`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
