"use client";

import { saveEncryptedJson, loadEncryptedJson, clearEncryptedJson } from "./secure-local-storage";

/**
 * Internal representation of a stored blob in browser storage.
 */
interface StoredBlob {
  platform: string;
  videoId: string;
  extension: "txt" | "md";
  content: string;
  createdAt: string;
}

/**
 * Result of checking for available blobs for a media item.
 */
export interface BlobLookupResult {
  /** Data URL for the transcript file, if found */
  transcriptUrl: string | null;
  /** Data URL for the notes file, if found */
  notesUrl: string | null;
}

const BLOB_STORAGE_KEY = "mhs_public_blobs";
const BLOB_KEY_STORAGE = "mhs_public_blobs_key";

/**
 * Loads and decrypts all blobs from localStorage.
 *
 * @returns Array of stored blobs, or empty array if none found
 */
async function loadStoredBlobs(): Promise<StoredBlob[]> {
  return (await loadEncryptedJson<StoredBlob[]>(BLOB_STORAGE_KEY, BLOB_KEY_STORAGE)) ?? [];
}

/**
 * Encrypts and saves the blob collection to localStorage.
 *
 * @param blobs - Complete collection of blobs to persist
 */
async function saveStoredBlobs(blobs: StoredBlob[]): Promise<void> {
  if (blobs.length === 0) {
    clearEncryptedJson(BLOB_STORAGE_KEY, BLOB_KEY_STORAGE);
    return;
  }
  await saveEncryptedJson(BLOB_STORAGE_KEY, BLOB_KEY_STORAGE, blobs);
}

/**
 * Stores a transcript or notes file in browser encrypted storage.
 * Returns a data URL that can be used to access the content immediately.
 *
 * @param platform - Source platform name
 * @param videoId - Platform-specific video ID
 * @param extension - File extension determining the MIME type
 * @param content - Raw text content to store
 * @returns RFC 2397 compliant data URL
 */
export async function storeBrowserBlob(
  platform: string,
  videoId: string,
  extension: "txt" | "md",
  content: string
): Promise<string> {
  const blobs = await loadStoredBlobs();

  // Check if blob already exists and update it
  const existingIndex = blobs.findIndex(
    (b) => b.platform === platform && b.videoId === videoId && b.extension === extension
  );

  const blob: StoredBlob = {
    platform,
    videoId,
    extension,
    content,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    blobs[existingIndex] = blob;
  } else {
    blobs.push(blob);
  }

  await saveStoredBlobs(blobs);

  // Return data URL
  const mimeType = extension === "txt" ? "text/plain" : "text/markdown";
  const dataUrl = `data:${mimeType};base64,${btoa(content)}`;
  return dataUrl;
}

/**
 * Retrieves a single blob's raw content from encrypted browser storage.
 *
 * @param platform - Source platform name
 * @param videoId - Platform-specific video ID
 * @param extension - File extension to search for
 * @returns The raw text content, or null if not found
 */
export async function getBrowserBlob(
  platform: string,
  videoId: string,
  extension: "txt" | "md"
): Promise<string | null> {
  const blobs = await loadStoredBlobs();
  const blob = blobs.find((b) => b.platform === platform && b.videoId === videoId && b.extension === extension);
  return blob?.content ?? null;
}

/**
 * Checks for the existence of transcript and notes blobs for a given media item.
 *
 * @param platform - Source platform name
 * @param videoId - Platform-specific video ID
 * @returns Object containing data URLs for found blobs
 */
export async function checkBrowserBlobFiles(
  platform: string,
  videoId: string
): Promise<BlobLookupResult> {
  const blobs = await loadStoredBlobs();

  let transcriptUrl: string | null = null;
  let notesUrl: string | null = null;

  for (const blob of blobs) {
    if (blob.platform === platform && blob.videoId === videoId) {
      if (blob.extension === "txt") {
        transcriptUrl = `data:text/plain;base64,${btoa(blob.content)}`;
      } else if (blob.extension === "md") {
        notesUrl = `data:text/markdown;base64,${btoa(blob.content)}`;
      }
    }
  }

  return { transcriptUrl, notesUrl };
}

/**
 * Deletes all associated blobs (transcript and notes) for a given media item.
 *
 * @param platform - Source platform name
 * @param videoId - Platform-specific video ID
 */
export async function deleteBrowserBlobs(platform: string, videoId: string): Promise<void> {
  const blobs = await loadStoredBlobs();
  const filtered = blobs.filter((b) => !(b.platform === platform && b.videoId === videoId));
  await saveStoredBlobs(filtered);
}
