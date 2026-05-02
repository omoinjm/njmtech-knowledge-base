import { Container, getContainer } from "@cloudflare/containers";

const INSTANCE_NAME = "blob-cron";

function compactEnvVars(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function buildBlobCronEnv(env) {
  return compactEnvVars({
    UPLOAD_BLOB_API_URL: env.UPLOAD_BLOB_API_URL,
    UPLOAD_BLOB_API_TOKEN: env.UPLOAD_BLOB_API_TOKEN,
    POSTGRES_URL: env.POSTGRES_URL,
    OLLAMA_MODEL_ID: env.OLLAMA_MODEL_ID,
    OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
    ROOT_SCAN_FOLDER: env.ROOT_SCAN_FOLDER,
    INFISICAL_ENABLED: env.INFISICAL_ENABLED,
    INFISICAL_PROJECT_ID: env.INFISICAL_PROJECT_ID,
    INFISICAL_ENVIRONMENT: env.INFISICAL_ENVIRONMENT,
    INFISICAL_SITE_URL: env.INFISICAL_SITE_URL,
    INFISICAL_CLIENT_ID: env.INFISICAL_CLIENT_ID,
    INFISICAL_CLIENT_SECRET: env.INFISICAL_CLIENT_SECRET,
    INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID,
    INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET,
  });
}

async function requireAdmin(request, env) {
  const expected = env.BLOB_CRON_ADMIN_TOKEN;
  if (!expected) {
    return new Response("BLOB_CRON_ADMIN_TOKEN is not configured.", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

function getBlobCronContainer(env) {
  return getContainer(env.BLOB_CRON_CONTAINER, INSTANCE_NAME);
}

async function startBlobCron(env) {
  const container = getBlobCronContainer(env);
  await container.start({
    envVars: buildBlobCronEnv(env),
  });
  return container;
}

async function safeState(container) {
  try {
    return await container.getState();
  } catch (error) {
    return {
      status: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export class BlobCronContainer extends Container {
  sleepAfter = "5m";

  onStart() {
    console.log("blob-cron container started");
  }

  onStop({ exitCode, reason }) {
    console.log("blob-cron container stopped", { exitCode, reason });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        service: "blob-cron-worker",
        endpoints: ["POST /admin/run", "GET /admin/state"],
      });
    }

    if (url.pathname === "/admin/run" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }

      const container = await startBlobCron(env);
      return Response.json(
        {
          started: true,
          state: await safeState(container),
        },
        { status: 202 },
      );
    }

    if (url.pathname === "/admin/state" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }

      return Response.json(await safeState(getBlobCronContainer(env)));
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env) {
    await startBlobCron(env);
  },
};
