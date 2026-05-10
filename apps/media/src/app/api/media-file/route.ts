import { basename } from "node:path";
import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set(["api.blob.njmtech.co.za", "s3.njmtech.co.za"]);
const ALLOWED_HOST_SUFFIXES = [".r2.dev", ".r2.cloudflarestorage.com"];
const ALLOWED_PATH_PREFIXES = ["/njmtech-blob-api/yt-transcribe/", "/public-media/"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname) || ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function inferContentType(pathname: string, kind: string | null): string {
  if (kind === "notes" || pathname.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

export async function GET(request: NextRequest): Promise<Response> {
  const rawUrl = request.nextUrl.searchParams.get("url");
  const kind = request.nextUrl.searchParams.get("kind");

  if (!rawUrl) {
    return new Response("Missing media file URL", { status: 400 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid media file URL", { status: 400 });
  }

  if (upstreamUrl.protocol !== "https:") {
    return new Response("Only HTTPS media file URLs are allowed", { status: 400 });
  }

  if (!isAllowedHost(upstreamUrl.hostname)) {
    return new Response("Unsupported media file host", { status: 403 });
  }

  const isAllowedPath =
    ALLOWED_PATH_PREFIXES.some((prefix) => upstreamUrl.pathname.startsWith(prefix)) &&
    (upstreamUrl.pathname.endsWith(".txt") || upstreamUrl.pathname.endsWith(".md"));

  if (!isAllowedPath) {
    return new Response("Unsupported media file path", { status: 403 });
  }

  const upstream = await fetch(upstreamUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return new Response("Failed to fetch media file", { status: upstream.status });
  }

  const body = await upstream.text();
  const filename = basename(upstreamUrl.pathname) || (kind === "notes" ? "notes.md" : "transcript.txt");

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Type": inferContentType(upstreamUrl.pathname, kind),
    },
  });
}
