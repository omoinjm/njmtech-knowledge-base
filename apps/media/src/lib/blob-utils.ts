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

export interface BlobLookupResult {
  transcriptUrl: string | null;
  notesUrl: string | null;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function checkBlobFiles(
  platform: string,
  videoId: string
): Promise<BlobLookupResult> {
  const token = env.uploadBlobApiToken;
  if (!token) {
    return { transcriptUrl: null, notesUrl: null };
  }

  const response = await fetch(
    `${normalizeBaseUrl(env.uploadBlobApiUrl)}/api/v1/blob/files?no_cache=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Blob lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BlobFilesResponse;
  const targetPath = `${PERSONAL_BLOB_ROOT}/${platform}/${videoId}`;
  const match = payload.data?.find((entry) => entry.path === targetPath);

  return {
    transcriptUrl: match?.txt_url ?? null,
    notesUrl: match?.md_url ?? null,
  };
}
