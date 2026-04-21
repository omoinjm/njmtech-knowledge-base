export async function register() {
  // Only run in the Node.js runtime (not in the Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadSecrets } = await import("./lib/secrets");
    await loadSecrets();
  }
}
