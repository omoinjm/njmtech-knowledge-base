import { Platform } from "@/types/media";

/**
 * Standard OEmbed response structure from providers.
 */
interface OEmbedResponse {
  /** The title of the resource */
  title?: string;
  /** URL to the resource's thumbnail image */
  thumbnail_url?: string;
  /** Name of the resource's author */
  author_name?: string;
  /** Name of the content provider (e.g., YouTube) */
  provider_name?: string;
  /** Error message if the request failed */
  error?: string;
}

/**
 * Result of the metadata extraction process.
 */
export interface VideoMeta {
  /** Identified hosting platform */
  platform: Platform;
  /** Unique ID of the video on its platform */
  videoId: string;
  /** Fetched or fallback title */
  title: string;
  /** URL to the best available thumbnail image */
  thumbnailUrl: string | null;
  /** Name of the content creator */
  authorName: string | null;
}

/**
 * Identifies the platform and video ID from a given URL using regex.
 *
 * @param url - The full URL of the media content
 * @returns Object containing platform and videoId, or null if no match found
 */
export function extractPlatformAndId(
  url: string
): { platform: Platform; videoId: string } | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return { platform: "youtube", videoId: ytMatch[1] };

  const igMatch = url.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return { platform: "instagram", videoId: igMatch[1] };

  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (ttMatch) return { platform: "tiktok", videoId: ttMatch[1] };

  const twMatch = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  if (twMatch) return { platform: "twitter", videoId: twMatch[1] };

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/);
  if (vimeoMatch) return { platform: "vimeo", videoId: vimeoMatch[1] };

  return null;
}

/**
 * Fetches rich metadata for a video using oEmbed and fallback scrapers.
 * Uses noembed.com as the primary provider and microlink.io as a fallback.
 *
 * @param url - The full URL of the media content
 * @returns Metadata object including title, thumbnail, and author
 *
 * @example
 * const meta = await fetchVideoMeta("https://youtube.com/watch?v=...");
 * console.log(meta.title);
 */
export async function fetchVideoMeta(url: string): Promise<VideoMeta> {
  const platformInfo = extractPlatformAndId(url);
  const platform = platformInfo?.platform ?? "unknown";
  const videoId = platformInfo?.videoId ?? crypto.randomUUID().slice(0, 11);

  let title = "Untitled";
  let thumbnailUrl: string | null = null;
  let authorName: string | null = null;

  try {
    // Primary attempt: oEmbed via noembed.com
    const endpoint = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = (await res.json()) as OEmbedResponse;
      if (!data.error) {
        title = data.title ?? title;
        thumbnailUrl = data.thumbnail_url ?? null;
        authorName = data.author_name ?? null;
      }
    }
  } catch (err) {
    console.warn(`[fetchVideoMeta] oEmbed failed for ${url}:`, err);
  }

  // Secondary fallback for specific platforms using Microlink (free tier)
  if (platform !== "youtube" && (title === "Untitled" || title === "Instagram" || !thumbnailUrl)) {
    try {
      const microlinkEndpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
      const mRes = await fetch(microlinkEndpoint, { next: { revalidate: 3600 } });
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.status === "success" && mData.data) {
          if (title === "Untitled" || title === "Instagram") {
            title = mData.data.title || title;
          }
          thumbnailUrl = thumbnailUrl || mData.data.image?.url || null;
          authorName = authorName || mData.data.author || null;
        }
      }
    } catch (err) {
      console.warn(`[fetchVideoMeta] Microlink fallback failed for ${url}:`, err);
    }
  }

  // Final sanitization and improved defaults for Instagram
  if (platform === "instagram") {
    if (title === "Untitled" || title === "Instagram") {
      title = `Instagram Post (${videoId})`;
    }
    if (!authorName) {
      authorName = "Instagram User";
    }
  }

  return { platform, videoId, title, thumbnailUrl, authorName };
}
