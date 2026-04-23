export async function register() {
  console.log(`[instrumentation] Registering instrumentation (Runtime: ${process.env.NEXT_RUNTIME}, Env: ${process.env.NODE_ENV})`);

  // Only run in the Node.js runtime (not in the Edge runtime)
  // and only in development. In prod, secrets are synced via integration.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { loadSecrets } = await import("./lib/secrets");
    await loadSecrets();
  }
}
