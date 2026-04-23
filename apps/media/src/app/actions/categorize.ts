"use server";

import { dbGetById, dbUpdateCategory } from "@/lib/db";
import { categorizeTranscript } from "@/lib/categorize";
import type { ActionResponse, CategorizeResult } from "@/types/api";

/**
 * Triggers the categorization process for a specific media item.
 * Updates the item's category, tags, and optionally its title in the database.
 *
 * @param id - The ID of the media item to categorize
 * @param transcriptUrl - Public URL of the transcript file
 * @returns Success status and the identified categorization details
 */
export async function categorizeItem(
  id: string,
  transcriptUrl: string
): Promise<ActionResponse<CategorizeResult>> {
  try {
    const result = await categorizeTranscript(transcriptUrl);
    if (!result) return { success: false, error: "Categorization returned no result" };

    const existing = await dbGetById(id);
    const needsTitleFix =
      !existing?.title ||
      existing.title === "Untitled" ||
      existing.title === "Instagram" ||
      existing.title.includes("Instagram Post");

    await dbUpdateCategory(
      id,
      result.category,
      result.tags,
      needsTitleFix ? result.title : undefined,
    );
    
    return {
      success: true,
      data: {
        category: result.category,
        tags: result.tags,
        title: needsTitleFix ? result.title : existing?.title,
      }
    };
  } catch (err) {
    console.error("[categorizeItem]", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Performs categorization on a transcript without updating the database.
 * Useful for previewing results for public items.
 *
 * @param transcriptUrl - Public URL of the transcript file
 * @returns Success status and the identified categorization details
 */
export async function categorizeTranscriptAction(
  transcriptUrl: string
): Promise<ActionResponse<CategorizeResult>> {
  try {
    const result = await categorizeTranscript(transcriptUrl);
    if (!result) return { success: false, error: "Categorization returned no result" };
    return { success: true, data: result };
  } catch (err) {
    console.error("[categorizeTranscriptAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
