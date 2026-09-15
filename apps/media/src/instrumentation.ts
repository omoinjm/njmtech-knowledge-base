export async function register() {
  console.log(`[instrumentation] Registering instrumentation (Runtime: ${process.env.NEXT_RUNTIME}, Env: ${process.env.NODE_ENV})`);

  // Only run in the Node.js runtime (not in the Edge runtime). loadSecrets()
  // itself no-ops when INFISICAL_* bootstrap vars aren't set (e.g. on Vercel,
  // where secrets are synced directly to the environment via integration).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadSecrets } = await import("./lib/secrets");
    await loadSecrets();
  }
}
