"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import { 
  dbGetMediaItems, 
  dbGetByUrl, 
  dbUpsertMediaItem, 
  dbGetById, 
  dbSoftDeleteMediaItem, 
  dbUpdateCategory 
} from "@/lib/db";
import { fetchVideoMeta } from "@/lib/metadata";
import { checkBlobFiles } from "@/lib/blob-utils";
import { categorizeTranscript } from "@/lib/categorize";
import type { MediaItem } from "@/types/media";
import type { ActionResponse, AddMediaResult } from "@/types/api";

/**
 * Retrieves all non-deleted media items from the database.
 * Results are cached for 60 seconds and tagged for revalidation.
 *
 * @returns Array of media items
 */
export const getMediaItems = unstable_cache(
  async (): Promise<MediaItem[]> => {
    try {
      return await dbGetMediaItems();
    } catch (err) {
      console.error("[getMediaItems] Failed to fetch media items from DB:", err);
      return [];
    }
  },
  ["media-items"],
  { tags: ["media"], revalidate: 60 }
);

/**
 * Resolves a URL into a structured media item by fetching its metadata.
 *
 * @param url - The URL to resolve
 * @returns Partial media item data
 */
async function resolveMediaItem(
  url: string
): Promise<Omit<MediaItem, "id" | "createdAt">> {
  const meta = await fetchVideoMeta(url);
  const blobFiles = await checkBlobFiles(meta.platform, meta.videoId);

  return {
    url,
    platform: meta.platform,
    videoId: meta.videoId,
    title: meta.title,
    thumbnailUrl: meta.thumbnailUrl,
    authorName: meta.authorName,
    transcriptUrl: blobFiles.transcriptUrl,
    notesUrl: blobFiles.notesUrl,
    category: null,
    tags: [],
  };
}

/**
 * Adds a new media item to the database or updates an existing one.
 * Triggers background categorization if a transcript is available.
 *
 * @param url - The URL of the media item to add
 * @returns Success status and the resulting item or error message
 */
export async function addMediaItem(
  url: string
): Promise<ActionResponse<AddMediaResult>> {
  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { success: false, error: "URL is required" };

    const existing = await dbGetByUrl(trimmedUrl);
    const resolvedItem = await resolveMediaItem(trimmedUrl);

    const item = await dbUpsertMediaItem({
      url: trimmedUrl,
      platform: resolvedItem.platform,
      videoId: resolvedItem.videoId,
      title: resolvedItem.title,
      thumbnailUrl: resolvedItem.thumbnailUrl,
      authorName: resolvedItem.authorName,
      transcriptUrl: resolvedItem.transcriptUrl,
      notesUrl: resolvedItem.notesUrl,
    });

    if (resolvedItem.transcriptUrl && !existing?.category) {
      // Background categorization
      categorizeTranscript(resolvedItem.transcriptUrl).then(async (result) => {
        if (result) {
          const needsTitleFix = 
            item.title === "Untitled" || 
            item.title === "Instagram" || 
            item.title.includes("Instagram Post");
            
          await dbUpdateCategory(
            item.id, 
            result.category, 
            result.tags, 
            needsTitleFix ? result.title : undefined
          );
          revalidateTag("media");
        }
      }).catch(err => console.error("[addMediaItem] Background categorization failed:", err));
    }

    revalidateTag("media");
    return { success: true, data: { item } };
  } catch (err) {
    console.error("[addMediaItem]", err);
    return { success: false, error: "Failed to add media item" };
  }
}

/**
 * Prepares a media item for public (client-side only) use without saving to DB.
 *
 * @param url - The URL of the media item
 * @returns Success status and a temporary media item with a unique ID
 */
export async function preparePublicMediaItem(
  url: string
): Promise<ActionResponse<AddMediaResult>> {
  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { success: false, error: "URL is required" };

    const resolvedItem = await resolveMediaItem(trimmedUrl);
    return {
      success: true,
      data: {
        item: {
          ...resolvedItem,
          id: `public-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString().slice(0, 10),
        }
      }
    };
  } catch (err) {
    console.error("[preparePublicMediaItem]", err);
    return { success: false, error: "Failed to prepare media item" };
  }
}

/**
 * Retrieves a single media item by its unique ID.
 *
 * @param id - The UUID of the media item
 * @returns The media item or null if not found
 */
export async function getMediaItemById(id: string): Promise<MediaItem | null> {
  return dbGetById(id);
}

/**
 * Performs a soft delete on a media item.
 *
 * @param id - The ID of the item to delete
 * @returns Success status or error message
 */
export async function softDeleteMediaItem(
  id: string
): Promise<ActionResponse> {
  try {
    const deleted = await dbSoftDeleteMediaItem(id);
    if (!deleted) {
      return { success: false, error: "Item not found" };
    }
    revalidateTag("media");
    return { success: true };
  } catch (err) {
    console.error("[softDeleteMediaItem]", err);
    return { success: false, error: "Failed to hide media item" };
  }
}
