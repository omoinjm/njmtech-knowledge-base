import { Container, getContainer } from "@cloudflare/containers";
const OPENAPI_SPEC = "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"yt-transcribe Worker API\",\"description\":\"Cloudflare Worker API for downloading, transcribing, and storing YouTube video transcripts.\\n\\nAll `/admin/*` routes require `Authorization: Bearer <YT_TRANSCRIBE_ADMIN_TOKEN>`.\",\"version\":\"1.0.0\"},\"servers\":[{\"url\":\"https://yt-transcribe-worker.njmalaza.workers.dev\",\"description\":\"Cloudflare Workers (production)\"}],\"components\":{\"securitySchemes\":{\"adminBearer\":{\"type\":\"http\",\"scheme\":\"bearer\",\"description\":\"Admin token set via `YT_TRANSCRIBE_ADMIN_TOKEN` wrangler secret.\"}},\"schemas\":{\"TranscribeRequest\":{\"type\":\"object\",\"required\":[\"url\"],\"properties\":{\"url\":{\"type\":\"string\",\"format\":\"uri\",\"example\":\"https://www.youtube.com/watch?v=rdWZo5PD9Ek\"}}},\"TranscribeResponse\":{\"type\":\"object\",\"properties\":{\"transcript_url\":{\"type\":\"string\",\"format\":\"uri\",\"description\":\"Blob URL where the transcript text file was uploaded.\"}}},\"ContainerState\":{\"type\":\"object\",\"properties\":{\"status\":{\"type\":\"string\",\"enum\":[\"healthy\",\"running\",\"stopped\",\"unknown\"]},\"lastChange\":{\"type\":\"integer\",\"description\":\"Unix timestamp (ms) of the last state transition.\"}}},\"AdminStateResponse\":{\"type\":\"object\",\"properties\":{\"api\":{\"$ref\":\"#/components/schemas/ContainerState\"},\"dbJob\":{\"$ref\":\"#/components/schemas/ContainerState\"},\"reprocessAll\":{\"$ref\":\"#/components/schemas/ContainerState\"}}},\"JobStartedResponse\":{\"type\":\"object\",\"properties\":{\"started\":{\"type\":\"boolean\"},\"job\":{\"type\":\"string\"},\"state\":{\"$ref\":\"#/components/schemas/ContainerState\"}}},\"JobResultResponse\":{\"type\":\"object\",\"properties\":{\"status\":{\"type\":\"string\",\"enum\":[\"success\",\"error\",\"idle\",\"no result yet\"]},\"message\":{\"type\":\"string\"},\"timestamp\":{\"type\":\"string\",\"format\":\"date-time\"}}},\"TestEnvResponse\":{\"type\":\"object\",\"description\":\"Boolean map of whether each required env var is set in the container.\",\"properties\":{\"WHISPER_MODEL_PATH\":{\"type\":\"boolean\"},\"UPLOAD_BLOB_API_URL\":{\"type\":\"boolean\"},\"UPLOAD_BLOB_API_TOKEN\":{\"type\":\"boolean\"},\"POSTGRES_URL\":{\"type\":\"boolean\"},\"PORT\":{\"type\":\"boolean\"},\"INFISICAL_ENABLED\":{\"type\":\"boolean\"}}},\"TestDbResponse\":{\"type\":\"object\",\"properties\":{\"ok\":{\"type\":\"boolean\"},\"postgres_url_set\":{\"type\":\"boolean\"},\"media_items_count\":{\"type\":\"integer\"}}},\"ErrorResponse\":{\"type\":\"object\",\"properties\":{\"error\":{\"type\":\"string\"}}}}},\"paths\":{\"/\":{\"get\":{\"summary\":\"Health check\",\"description\":\"Returns 200 OK when the API container is running.\",\"operationId\":\"healthCheck\",\"responses\":{\"200\":{\"description\":\"API container is healthy.\"}}}},\"/api/transcribe\":{\"post\":{\"summary\":\"Transcribe a YouTube video\",\"description\":\"Downloads audio from the given YouTube URL, transcribes it with whisper.cpp, uploads the transcript to blob storage, and returns the blob URL.\",\"operationId\":\"transcribeVideo\",\"requestBody\":{\"required\":true,\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/TranscribeRequest\"}}}},\"responses\":{\"200\":{\"description\":\"Transcription successful.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/TranscribeResponse\"}}}},\"400\":{\"description\":\"Bad request (missing or invalid URL).\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ErrorResponse\"}}}},\"500\":{\"description\":\"Transcription or upload failed.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ErrorResponse\"}}}},\"503\":{\"description\":\"Service initialisation failed (missing env vars or Infisical error).\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ErrorResponse\"}}}}}}},\"/admin/state\":{\"get\":{\"summary\":\"Container state\",\"description\":\"Returns the current state of the API container and both job containers.\",\"operationId\":\"getAdminState\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Current container states.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/AdminStateResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/jobs/db\":{\"post\":{\"summary\":\"Run DB transcription job\",\"description\":\"Starts a job container that fetches the next unprocessed `media_items` row, transcribes it, and updates `transcript_url`. Runs on a cron every 15 minutes; this endpoint triggers it on demand.\",\"operationId\":\"triggerDbJob\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"202\":{\"description\":\"Job started.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/JobStartedResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/jobs/reprocess-all\":{\"post\":{\"summary\":\"Reprocess all media items\",\"description\":\"Starts a job container that re-transcribes every row in `media_items`, overwriting existing `transcript_url` values. Individual failures are logged and skipped.\",\"operationId\":\"triggerReprocessAllJob\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"202\":{\"description\":\"Job started.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/JobStartedResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/job-result\":{\"get\":{\"summary\":\"Last job result\",\"description\":\"Returns the status and message reported by the most recent job container run. Stored in Durable Object SQLite — survives Worker restarts.\",\"operationId\":\"getJobResult\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Last job result, or `{\\\"status\\\": \\\"no result yet\\\"}` if no job has run since deploy.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/JobResultResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/test-env\":{\"get\":{\"summary\":\"Check container env vars\",\"description\":\"Starts the API container and returns a boolean map of whether each required environment variable is set.\",\"operationId\":\"testEnv\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Env var presence map.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/TestEnvResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/test-db\":{\"get\":{\"summary\":\"Test database connectivity\",\"description\":\"Starts the API container, connects to Postgres, and returns the row count of `media_items`.\",\"operationId\":\"testDb\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"DB connectivity result.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/TestDbResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/logs/job\":{\"get\":{\"summary\":\"Job container raw logs\",\"description\":\"Returns the full stdout/stderr buffer from the job (db) container since its last start. Useful for seeing raw Go binary output that is not captured by wrangler tail.\",\"operationId\":\"getJobLogs\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Raw container log output as plain text.\",\"content\":{\"text/plain\":{\"schema\":{\"type\":\"string\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/logs/api\":{\"get\":{\"summary\":\"API container raw logs\",\"description\":\"Returns the full stdout/stderr buffer from the API container since its last start.\",\"operationId\":\"getApiLogs\",\"security\":[{\"adminBearer\":[]}],\"responses\":{\"200\":{\"description\":\"Raw container log output as plain text.\",\"content\":{\"text/plain\":{\"schema\":{\"type\":\"string\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}},\"/admin/retry-state\":{\"get\":{\"summary\":\"Get retry state for item\",\"description\":\"Starts the API container and returns retry metadata from Postgres for a specific media item id.\",\"operationId\":\"getRetryState\",\"security\":[{\"adminBearer\":[]}],\"parameters\":[{\"name\":\"id\",\"in\":\"query\",\"required\":true,\"description\":\"media_items.id UUID\",\"schema\":{\"type\":\"string\"}}],\"responses\":{\"200\":{\"description\":\"Retry state payload (or found=false when no row exists).\",\"content\":{\"application/json\":{\"schema\":{\"type\":\"object\"}}}},\"400\":{\"description\":\"Missing id query param.\",\"content\":{\"application/json\":{\"schema\":{\"$ref\":\"#/components/schemas/ErrorResponse\"}}}},\"401\":{\"description\":\"Unauthorized.\"}}}}}}";

const API_INSTANCE_NAME = "api";
const DB_JOB_INSTANCE_NAME = "db-job";
const REPROCESS_JOB_INSTANCE_NAME = "reprocess-all";

function compactEnvVars(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function buildYTTranscribeEnv(env, extra = {}) {
  return compactEnvVars({
    WHISPER_MODEL_PATH: env.WHISPER_MODEL_PATH,
    WHISPER_THREADS: env.WHISPER_THREADS,
    WHISPER_EXTRA_ARGS: env.WHISPER_EXTRA_ARGS,
    UPLOAD_BLOB_API_URL: env.UPLOAD_BLOB_API_URL,
    UPLOAD_BLOB_API_TOKEN: env.UPLOAD_BLOB_API_TOKEN,
    POSTGRES_URL: env.POSTGRES_URL,
    YT_DLP_COOKIES_FILE: env.YT_DLP_COOKIES_FILE,
    YT_DLP_COOKIES_FROM_BROWSER: env.YT_DLP_COOKIES_FROM_BROWSER,
    YT_DLP_COOKIES_CONTENT: env.YT_DLP_COOKIES_CONTENT,
    YT_DLP_COOKIES_CONTENT_B64: env.YT_DLP_COOKIES_CONTENT_B64,
    YT_DLP_COOKIES_CONTENT_PART1: env.YT_DLP_COOKIES_CONTENT_PART1,
    YT_DLP_COOKIES_CONTENT_PART2: env.YT_DLP_COOKIES_CONTENT_PART2,
    YT_DLP_COOKIES_CONTENT_PART3: env.YT_DLP_COOKIES_CONTENT_PART3,
    YT_DLP_COOKIES_CONTENT_PART4: env.YT_DLP_COOKIES_CONTENT_PART4,
    YT_DLP_COOKIES_CONTENT_PART5: env.YT_DLP_COOKIES_CONTENT_PART5,
    YT_DLP_COOKIES_CONTENT_PART6: env.YT_DLP_COOKIES_CONTENT_PART6,
    YT_DLP_COOKIES_CONTENT_PART7: env.YT_DLP_COOKIES_CONTENT_PART7,
    YT_DLP_COOKIES_CONTENT_PART8: env.YT_DLP_COOKIES_CONTENT_PART8,
    YT_DLP_COOKIES_CONTENT_PART9: env.YT_DLP_COOKIES_CONTENT_PART9,
    INFISICAL_ENABLED: env.INFISICAL_ENABLED,
    INFISICAL_PROJECT_ID: env.INFISICAL_PROJECT_ID,
    INFISICAL_ENVIRONMENT: env.INFISICAL_ENVIRONMENT,
    INFISICAL_SITE_URL: env.INFISICAL_SITE_URL,
    INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID,
    INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET,
    INFISICAL_CLIENT_ID: env.INFISICAL_CLIENT_ID,
    INFISICAL_CLIENT_SECRET: env.INFISICAL_CLIENT_SECRET,
    JOB_CALLBACK_URL: "https://yt-transcribe-worker.njmalaza.workers.dev/admin/job-result",
    JOB_CALLBACK_TOKEN: env.YT_TRANSCRIBE_ADMIN_TOKEN,
    ...extra,
  });
}

async function requireAdmin(request, env) {
  const expected = env.YT_TRANSCRIBE_ADMIN_TOKEN;
  if (!expected) {
    return new Response("YT_TRANSCRIBE_ADMIN_TOKEN is not configured.", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

function getAPIContainer(env) {
  return getContainer(env.YT_TRANSCRIBE_API_CONTAINER, API_INSTANCE_NAME);
}

function getJobContainer(env, instanceName) {
  return getContainer(env.YT_TRANSCRIBE_JOB_CONTAINER, instanceName);
}

function logJobResult(bodyText) {
  try {
    const payload = JSON.parse(bodyText);
    const status = payload?.status ?? "unknown";
    const message = payload?.message ?? "";
    console.log(`yt-transcribe job result [${status}]${message ? ` ${message}` : ""}`);
  } catch {
    console.log(`yt-transcribe job result ${bodyText}`);
  }
}

async function sendDiscordFailureAlert(env, bodyText) {
  const webhookURL = env.DISCORD_WEBHOOK_URL;
  if (!webhookURL) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = { status: "unknown", message: bodyText };
  }

  if (payload?.status !== "error") {
    return;
  }

  const contentLines = [
    "yt-transcribe job failure",
    `status: ${payload.status ?? "unknown"}`,
    `message: ${String(payload.message ?? "(no message)")}`,
  ];

  const maxChars = 1900;
  let content = contentLines.join("\n");
  if (content.length > maxChars) {
    content = content.slice(0, maxChars - 3) + "...";
  }

  try {
    await fetch(webhookURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (error) {
    console.log("Failed to send Discord failure alert", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function startAPIContainer(env) {
  const container = getAPIContainer(env);
  await container.startAndWaitForPorts({
    startOptions: {
      envVars: buildYTTranscribeEnv(env, { PORT: "3000" }),
    },
  });
  return container;
}

async function startJobContainer(env, instanceName, args) {
  const container = getJobContainer(env, instanceName);
  console.log(`Starting yt-transcribe job container "${instanceName}" with args: ${args.join(" ")}`);
  await container.start({
    entrypoint: ["/usr/local/bin/entrypoint.sh", ...args],
    envVars: buildYTTranscribeEnv(env),
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

export class YTTranscribeAPIContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";

  onStart() {
    console.log("yt-transcribe API container started");
  }

  onStop({ exitCode, reason }) {
    console.log("yt-transcribe API container stopped", { exitCode, reason });
  }
}

export class YTTranscribeJobContainer extends Container {
  sleepAfter = "5m";

  onStart() {
    console.log("yt-transcribe job container started");
  }

  onStop({ exitCode, reason }) {
    console.log("yt-transcribe job container stopped", { exitCode, reason });
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
      return new Response(OPENAPI_SPEC, {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>yt-transcribe API Docs</title>
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

    // Receives status callbacks from the job container binary — stored in DO storage.
    if (url.pathname === "/admin/job-result" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const body = await request.text();
      logJobResult(body);
      await sendDiscordFailureAlert(env, body);
      return getJobContainer(env, DB_JOB_INSTANCE_NAME).fetch(
        new Request("http://do/result", { method: "POST", body, headers: { "content-type": "application/json" } }),
      );
    }

    if (url.pathname === "/admin/job-result" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      return getJobContainer(env, DB_JOB_INSTANCE_NAME).fetch(
        new Request("http://do/result", { method: "GET" }),
      );
    }

    if (url.pathname === "/admin/state" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }

      return Response.json({
        api: await safeState(getAPIContainer(env)),
        dbJob: await safeState(getJobContainer(env, DB_JOB_INSTANCE_NAME)),
        reprocessAll: await safeState(getJobContainer(env, REPROCESS_JOB_INSTANCE_NAME)),
      });
    }

    if (url.pathname === "/admin/jobs/db" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }

      const container = await startJobContainer(env, DB_JOB_INSTANCE_NAME, ["-db"]);
      return Response.json(
        {
          started: true,
          job: "db",
          state: await safeState(container),
        },
        { status: 202 },
      );
    }

    if (url.pathname === "/admin/jobs/reprocess-all" && request.method === "POST") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }

      const container = await startJobContainer(env, REPROCESS_JOB_INSTANCE_NAME, ["-reprocess-all"]);
      return Response.json(
        {
          started: true,
          job: "reprocess-all",
          state: await safeState(container),
        },
        { status: 202 },
      );
    }

    if (url.pathname === "/admin/test-env" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const container = await startAPIContainer(env);
      return container.fetch(new Request("http://container/debug/env", { method: "GET" }));
    }

    if (url.pathname === "/admin/test-db" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const container = await startAPIContainer(env);
      return container.fetch(new Request("http://container/debug/db", { method: "GET" }));
    }

    if (url.pathname === "/admin/retry-state" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const id = url.searchParams.get("id");
      if (!id) {
        return Response.json({ error: "missing required query param: id" }, { status: 400 });
      }
      const container = await startAPIContainer(env);
      return container.fetch(new Request(`http://container/debug/retry-state?id=${encodeURIComponent(id)}`, { method: "GET" }));
    }

    // Returns raw stdout/stderr from the job container (full buffer since last start).
    if (url.pathname === "/admin/logs/job" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const container = getJobContainer(env, DB_JOB_INSTANCE_NAME);
      try {
        const logs = await container.getLogs();
        return new Response(logs ?? "(no logs)", { headers: { "content-type": "text/plain; charset=utf-8" } });
      } catch (error) {
        const state = await safeState(container);
        return Response.json(
          {
            error: "Failed to read job container logs",
            details: error instanceof Error ? error.message : String(error),
            state,
          },
          { status: 503 },
        );
      }
    }

    // Returns raw stdout/stderr from the API container.
    if (url.pathname === "/admin/logs/api" && request.method === "GET") {
      const unauthorized = await requireAdmin(request, env);
      if (unauthorized) {
        return unauthorized;
      }
      const container = getAPIContainer(env);
      try {
        const logs = await container.getLogs();
        return new Response(logs ?? "(no logs)", { headers: { "content-type": "text/plain; charset=utf-8" } });
      } catch (error) {
        const state = await safeState(container);
        return Response.json(
          {
            error: "Failed to read API container logs",
            details: error instanceof Error ? error.message : String(error),
            state,
          },
          { status: 503 },
        );
      }
    }

    const container = await startAPIContainer(env);
    return container.fetch(request);
  },

  async scheduled(_controller, env) {
    console.log("Cron trigger received for yt-transcribe DB job");
    await startJobContainer(env, DB_JOB_INSTANCE_NAME, ["-db"]);
  },
};
