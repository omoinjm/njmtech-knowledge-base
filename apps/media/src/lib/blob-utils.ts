import { env } from "./env";

interface BlobGroup {
  path: string;
  txt_url: string | null;
  md_url: string | null;
}

interface BlobFilesResponse {
  data?: BlobGroup[];
}

const PERSONAL_BLOB_ROOT = "njmtech-blob-api/yt-transcribe";
const BLOB_FILE_LIST_PATHS = ["/api/v1/blob/files", "/api/v1/files"] as const;

export interface BlobLookupResult {
  transcriptUrl: string | null;
  notesUrl: string | null;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchBlobGroups(token: string): Promise<BlobGroup[]> {
  const baseUrl = normalizeBaseUrl(env.uploadBlobApiUrl);

  for (const path of BLOB_FILE_LIST_PATHS) {
    const response = await fetch(`${baseUrl}${path}?no_cache=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const payload = (await response.json()) as BlobFilesResponse;
      return payload.data ?? [];
    }

    if (response.status !== 404) {
      throw new Error(`Blob lookup failed with status ${response.status}`);
    }
  }

  console.warn(
    "[checkBlobFiles] Blob list endpoints returned 404; continuing without transcript/notes lookup."
  );
  return [];
}

export async function checkBlobFiles(
  platform: string,
  videoId: string
): Promise<BlobLookupResult> {
  const token = env.uploadBlobApiToken;
  if (!token) {
    return { transcriptUrl: null, notesUrl: null };
  }

  const targetPath = `${PERSONAL_BLOB_ROOT}/${platform}/${videoId}`;
  const groups = await fetchBlobGroups(token);
  const match = groups.find((entry) => entry.path === targetPath);

  return {
    transcriptUrl: match?.txt_url ?? null,
    notesUrl: match?.md_url ?? null,
  };
}
