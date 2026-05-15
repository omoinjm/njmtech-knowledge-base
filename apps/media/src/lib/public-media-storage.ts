"use client";

import type { KnowledgeBase, MediaItem } from "@/types/media";
import { clearEncryptedJson, loadEncryptedJson, saveEncryptedJson } from "./secure-local-storage";
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  generateKnowledgeBaseSlug,
  normalizeKnowledgeBaseName,
} from "./knowledge-bases";

interface StoredPublicMediaItem {
  knowledgeBaseId: string;
  item: MediaItem;
  deletedAt: string | null;
}

const STORAGE_KEY = "mhs_public_media_items";
const KEY_STORAGE = "mhs_public_media_items_key";
const KNOWLEDGE_BASES_STORAGE_KEY = "mhs_public_knowledge_bases";
const KNOWLEDGE_BASES_KEY_STORAGE = "mhs_public_knowledge_bases_key";

async function loadStoredKnowledgeBases(): Promise<KnowledgeBase[]> {
  return (await loadEncryptedJson<KnowledgeBase[]>(
    KNOWLEDGE_BASES_STORAGE_KEY,
    KNOWLEDGE_BASES_KEY_STORAGE,
  )) ?? [];
}

async function saveStoredKnowledgeBases(knowledgeBases: KnowledgeBase[]): Promise<void> {
  if (knowledgeBases.length === 0) {
    clearEncryptedJson(KNOWLEDGE_BASES_STORAGE_KEY, KNOWLEDGE_BASES_KEY_STORAGE);
    return;
  }

  await saveEncryptedJson(KNOWLEDGE_BASES_STORAGE_KEY, KNOWLEDGE_BASES_KEY_STORAGE, knowledgeBases);
}

async function ensurePublicKnowledgeBases(): Promise<KnowledgeBase[]> {
  const knowledgeBases = await loadStoredKnowledgeBases();
  if (knowledgeBases.length > 0) {
    return knowledgeBases;
  }

  const defaultKnowledgeBase: KnowledgeBase = {
    id: crypto.randomUUID(),
    name: DEFAULT_KNOWLEDGE_BASE_NAME,
    slug: DEFAULT_KNOWLEDGE_BASE_SLUG,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  await saveStoredKnowledgeBases([defaultKnowledgeBase]);
  return [defaultKnowledgeBase];
}

async function loadStoredItems(): Promise<StoredPublicMediaItem[]> {
  const knowledgeBases = await ensurePublicKnowledgeBases();
  const defaultKnowledgeBaseId = knowledgeBases[0]?.id ?? crypto.randomUUID();
  const storedItems = (await loadEncryptedJson<StoredPublicMediaItem[]>(STORAGE_KEY, KEY_STORAGE)) ?? [];

  const migratedItems = storedItems.map((entry) => ({
    ...entry,
    knowledgeBaseId: entry.knowledgeBaseId ?? entry.item.knowledgeBaseId ?? defaultKnowledgeBaseId,
    item: {
      ...entry.item,
      knowledgeBaseId: entry.item.knowledgeBaseId ?? entry.knowledgeBaseId ?? defaultKnowledgeBaseId,
    },
  }));

  const needsMigration = migratedItems.some((entry, index) => {
    const original = storedItems[index];
    return (
      original?.knowledgeBaseId !== entry.knowledgeBaseId ||
      original?.item.knowledgeBaseId !== entry.item.knowledgeBaseId
    );
  });

  if (needsMigration) {
    await saveStoredItems(migratedItems);
  }

  return migratedItems;
}

async function saveStoredItems(items: StoredPublicMediaItem[]): Promise<void> {
  if (items.length === 0) {
    clearEncryptedJson(STORAGE_KEY, KEY_STORAGE);
    return;
  }
  await saveEncryptedJson(STORAGE_KEY, KEY_STORAGE, items);
}

function sortVisibleItems(items: StoredPublicMediaItem[], knowledgeBaseId: string): MediaItem[] {
  return items
    .filter((entry) => entry.knowledgeBaseId === knowledgeBaseId && entry.deletedAt === null)
    .map((entry) => entry.item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadPublicKnowledgeBases(): Promise<KnowledgeBase[]> {
  return ensurePublicKnowledgeBases();
}

export async function createPublicKnowledgeBase(name: string): Promise<{
  knowledgeBase: KnowledgeBase;
  knowledgeBases: KnowledgeBase[];
}> {
  const knowledgeBases = await ensurePublicKnowledgeBases();
  const normalizedName = normalizeKnowledgeBaseName(name);
  const slug = generateKnowledgeBaseSlug(
    normalizedName,
    knowledgeBases.map((knowledgeBase) => knowledgeBase.slug),
  );

  const knowledgeBase: KnowledgeBase = {
    id: crypto.randomUUID(),
    name: normalizedName,
    slug,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const nextKnowledgeBases = [...knowledgeBases, knowledgeBase];
  await saveStoredKnowledgeBases(nextKnowledgeBases);

  return {
    knowledgeBase,
    knowledgeBases: nextKnowledgeBases,
  };
}

export async function loadPublicMediaItems(knowledgeBaseId: string): Promise<MediaItem[]> {
  return sortVisibleItems(await loadStoredItems(), knowledgeBaseId);
}

export async function upsertPublicMediaItem(
  item: MediaItem,
  knowledgeBaseId: string,
): Promise<{ item: MediaItem; items: MediaItem[] }> {
  const items = await loadStoredItems();
  const nextItem = {
    ...item,
    knowledgeBaseId,
  };
  const existingIndex = items.findIndex(
    (entry) => entry.knowledgeBaseId === knowledgeBaseId && entry.item.url === nextItem.url,
  );
  let storedItem = nextItem;

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    storedItem = {
      ...existing.item,
      ...nextItem,
      id: existing.item.id,
      knowledgeBaseId,
      category: nextItem.category ?? existing.item.category,
      tags: nextItem.tags.length > 0 ? nextItem.tags : existing.item.tags,
      createdAt: existing.item.createdAt,
    };
    // Restore soft-deleted item when re-submitting same URL
    items[existingIndex] = {
      knowledgeBaseId,
      deletedAt: null,
      item: storedItem,
    };
  } else {
    items.unshift({ knowledgeBaseId, item: nextItem, deletedAt: null });
    storedItem = nextItem;
  }

  await saveStoredItems(items);
  return { item: storedItem, items: sortVisibleItems(items, knowledgeBaseId) };
}

export async function updatePublicMediaCategory(
  id: string,
  knowledgeBaseId: string,
  category: string,
  tags: string[],
  title?: string
): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.knowledgeBaseId === knowledgeBaseId && entry.item.id === id
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
  return sortVisibleItems(nextItems, knowledgeBaseId);
}

export async function updatePublicMediaItem(
  id: string,
  knowledgeBaseId: string,
  patch: Partial<Pick<MediaItem, "transcriptUrl" | "notesUrl" | "category" | "tags" | "thumbnailUrl" | "authorName" | "title">>
): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.knowledgeBaseId === knowledgeBaseId && entry.item.id === id
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
  return sortVisibleItems(nextItems, knowledgeBaseId);
}

export async function softDeletePublicMediaItem(id: string, knowledgeBaseId: string): Promise<MediaItem[]> {
  const items = await loadStoredItems();
  const nextItems = items.map((entry) =>
    entry.knowledgeBaseId === knowledgeBaseId && entry.item.id === id
      ? {
          ...entry,
          deletedAt: new Date().toISOString(),
        }
      : entry
  );
  await saveStoredItems(nextItems);
  return sortVisibleItems(nextItems, knowledgeBaseId);
}
