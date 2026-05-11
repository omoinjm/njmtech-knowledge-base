const OPENAPI_SPEC = "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"blob-cron Worker API\",\"description\":\"Cloudflare Worker API for the blob-cron job \\u2014 scans directories, transforms markdown, and uploads to blob storage.\\n\\nAll `/admin/*` routes require `Authorization: Bearer <BLOB_CRON_ADMIN_TOKEN>`.\",\"version\":\"1.0.0\"},\"servers\":[{\"url\":\"https://blob-cron-worker.njmalaza.workers.dev\",\"description\":\"Cloudflare Workers (production)\"}],\"components\":{\"securitySchemes\":{\"adminBearer\":{\"type\":\"http\",\"scheme\":\"bearer\",\"description\":\"Admin token set via `BLOB_CRON_ADMIN_TOKEN` wrangler secret.\"}},\"schemas\":{\"ContainerState\":{\"type\":\"object\",\"properties\":{\"status\":{\"type\":\"string\",\"enum\":[\"healthy\",\"running\",\"stopped\",\"unknown\"]},\"lastChange\":{\"type\":\"integer\",\"description\":\"Unix timestamp (ms) of the last state transition.\"}}},\"RunResponse\":{\"type\":\"object\",\"properties\":{\"started\":{\"type\":\"boolean\"},\"state\":{\"$ref\":\"#/components/schemas/ContainerState\"}}},\"JobResultResponse\":{\"type\":\"object\",\"properties\":{\"status\":{\"type\":\"string\",\"enum\":[\"success\",\"error\",\"no result yet\"]},\"message\":{\"type\":\"string\"},\"timestamp\":{\"type\":\"string\",\"format\":\"date-time\"}}},\"ServiceInfoResponse\":{\"type\":\"object\",\"properties\":{\"service\":{\"type\":\"string\"},\"endpoints\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}}}}},\"paths\":{\"/\":{\"get\":{\"summary\":\"Service info\",\"description\":\"Returns the service name and available endpoints.\",\"operationId\":\"serviceInfo\",\"responses\":{\"200\":{\"description\":\"Service info.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ServiceInfoResponse\"}}}}}}},\"/admin/run\":{\"post\":{\"summary\":\"Trigger blob-cron job\",\"description\":\"Starts the blob-cron container on demand. Also runs on a cron every minute.\",\"operationId\":\"triggerRun\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"202\":{\"description\":\"Job started.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/RunResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/state\":{\"get\":{\"summary\":\"Container state\",\"description\":\"Returns the current state of the blob-cron container.\",\"operationId\":\"getState\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Container state.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ContainerState\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/job-result\":{\"get\":{\"summary\":\"Last job result\",\"description\":\"Returns the status and message from the most recent container run. Stored in Durable Object SQLite.\",\"operationId\":\"getJobResult\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Last job result.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/JobResultResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/logs\":{\"get\":{\"summary\":\"Container raw logs\",\"description\":\"Returns the full stdout/stderr buffer from the container since its last start.\",\"operationId\":\"getLogs\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Raw container log output as plain text.\",\"content\":{\"text/plain\":{\"schema\":{\"type\":\"string\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/docs\":{\"get\":{\"summary\":\"Swagger UI\",\"description\":\"Interactive API documentation.\",\"operationId\":\"swaggerUI\",\"responses\":{\"200\":{\"description\":\"HTML Swagger UI page.\"}}}},\"/docs/openapi.json\":{\"get\":{\"summary\":\"OpenAPI spec\",\"description\":\"OpenAPI 3.1 specification for this API.\",\"operationId\":\"openapiSpec\",\"responses\":{\"200\":{\"description\":\"OpenAPI JSON spec.\",\"content\":{\"application/json\":{\"schema\":{\"type\":\"object\"}}}}}}}}}";
import { Container, getContainer } from "@cloudflare/containers";

const INSTANCE_NAME = "blob-cron";
const REPROCESS_INSTANCE_NAME = "blob-cron-reprocess-all";

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
    JOB_CALLBACK_URL: "https://blob-cron-worker.njmalaza.workers.dev/admin/job-result",
    JOB_CALLBACK_TOKEN: env.BLOB_CRON_ADMIN_TOKEN,
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

function getReprocessContainer(env) {
  return getContainer(env.BLOB_CRON_CONTAINER, REPROCESS_INSTANCE_NAME);
}

async function startBlobCron(env, args = []) {
  const container = args.includes("-reprocess-all")
    ? getReprocessContainer(env)
    : getBlobCronContainer(env);
  await container.start({ envVars: buildBlobCronEnv(env), args });
  return container;
}

async function safeState(container) {
  try {
    return await container.getState();
  } catch (error) {
    return { status: "unknown", error: error instanceof Error ? error.message : String(error) };
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

  // Store/retrieve the last job result in Durable Object persistent storage.
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/result" && request.method === "POST") {
      const body = await request.json();
      await this.ctx.storage.put("lastJobResult", { ...body, timestamp: new Date().toISOString() });
      return new Response("ok", { status: 200 });
    }
    if (url.pathname === "/result" && request.method === "GET") {
      const result = await this.ctx.storage.get("lastJobResult");
      return Response.json(result ?? { status: "no result yet" });
    }
    return super.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/docs/openapi.json") {
      return new Response(OPENAPI_SPEC, { headers: { "content-type": "application/json; charset=utf-8" } });
    }

    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>blob-cron API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "/docs/openapi.json", dom_id: "#swagger-ui", presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset] });
  </script>
</body>
</html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    if (url.pathname === "/") {
      return Response.json({
        service: "blob-cron-worker",
        endpoints: [
          "GET /docs", "GET /docs/openapi.json",
          "POST /admin/run", "GET /admin/state",
          "POST /admin/jobs/reprocess-all",
          "GET /admin/job-result", "GET /admin/logs",
        ],
      });
    }

    // Receives status callbacks from the container — stored in DO storage.
    if (url.pathname === "/admin/job-result" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      const body = await request.text();
      return getBlobCronContainer(env).fetch(
        new Request("http://do/result", { method: "POST", body, headers: { "content-type": "application/json" } }),
      );
    }

    if (url.pathname === "/admin/job-result" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      return getBlobCronContainer(env).fetch(new Request("http://do/result", { method: "GET" }));
    }

    if (url.pathname === "/admin/run" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      const container = await startBlobCron(env);
      return Response.json({ started: true, state: await safeState(container) }, { status: 202 });
    }

    if (url.pathname === "/admin/jobs/reprocess-all" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      const container = await startBlobCron(env, ["-reprocess-all"]);
      return Response.json({ started: true, state: await safeState(container) }, { status: 202 });
    }

    if (url.pathname === "/admin/state" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      return Response.json(await safeState(getBlobCronContainer(env)));
    }

    if (url.pathname === "/admin/logs" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      const logs = await getBlobCronContainer(env).getLogs();
      return new Response(logs ?? "(no logs)", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env) {
    await startBlobCron(env);
  },
};
