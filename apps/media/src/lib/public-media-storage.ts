"use client";

import type { MediaItem } from "@/types/media";
import { clearEncryptedJson, loadEncryptedJson, saveEncryptedJson } from "./secure-local-storage";

interface StoredPublicMediaItem {
  item: MediaItem;
  deletedAt: string | null;
}

const STORAGE_KEY = "mhs_public_media_items";
const KEY_STORAGE = "mhs_public_media_items_key";

async function loadStoredItems(): Promise<StoredPublicMediaItem[]> {
  return (await loadEncryptedJson<StoredPublicMediaItem[]>(STORAGE_KEY, KEY_STORAGE)) ?? [];
}

async function saveStoredItems(items: StoredPublicMediaItem[]): Promise<void> {
  if (items.length === 0) {
    clearEncryptedJson(STORAGE_KEY, KEY_STORAGE);
    return;
  }
  await saveEncryptedJson(STORAGE_KEY, KEY_STORAGE, items);
}

function sortVisibleItems(items: StoredPublicMediaItem[]): MediaItem[] {
  return items
    .filter((entry) => entry.deletedAt === null)
    .map((entry) => entry.item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadPublicMediaItems(): Promise<MediaItem[]> {
  return sortVisibleItems(await loadStoredItems());
}

export async function upsertPublicMediaItem(item: MediaItem): Promise<{ item: MediaItem; items: MediaItem[] }> {
  const items = await loadStoredItems();
  const existingIndex = items.findIndex((entry) => entry.item.url === item.url);
  let storedItem = item;

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    storedItem = {
      ...existing.item,
      ...item,
      id: existing.item.id,
      category: item.category ?? existing.item.category,
      tags: item.tags.length > 0 ? item.tags : existing.item.tags,
      createdAt: existing.item.createdAt,
    };
    // Restore soft-deleted item when re-submitting same URL
    items[existingIndex] = {
      deletedAt: null,
      item: storedItem,
    };
  } else {
    items.unshift({ item, deletedAt: null });
    storedItem = item;
  }

  await saveStoredItems(items);
  return { item: storedItem, items: sortVisibleItems(items) };
}

export async function updatePublicMediaCategory(
  id: string,
  category: string,
  tags: string[],
  title?: string
): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.item.id === id
      ? {
          ...entry,
          item: {
            ...entry.item,
            category,
            tags,
            title: title || entry.item.title,
          },
        }
      : entry
  );
  await saveStoredItems(nextItems);
  return sortVisibleItems(nextItems);
}

export async function updatePublicMediaItem(
  id: string,
  patch: Partial<Pick<MediaItem, "transcriptUrl" | "notesUrl" | "category" | "tags" | "thumbnailUrl" | "authorName" | "title">>
): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.item.id === id
      ? {
          ...entry,
          item: {
            ...entry.item,
            ...patch,
          },
        }
      : entry
  );
  await saveStoredItems(nextItems);
  return sortVisibleItems(nextItems);
}

export async function softDeletePublicMediaItem(id: string): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.item.id === id
      ? {
          ...entry,
          deletedAt: new Date().toISOString(),
        }
      : entry
  );
  await saveStoredItems(nextItems);
  return sortVisibleItems(nextItems);
}
