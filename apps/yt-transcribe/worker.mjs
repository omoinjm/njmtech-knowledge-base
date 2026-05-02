import { Container, getContainer } from "@cloudflare/containers";

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
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    const container = await startAPIContainer(env);
    return container.fetch(request);
  },

  async scheduled(_controller, env) {
    await startJobContainer(env, DB_JOB_INSTANCE_NAME, ["-db"]);
  },
};
