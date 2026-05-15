import type { KnowledgeBaseMode } from "@/types/media";

export const DEFAULT_KNOWLEDGE_BASE_NAME = "General";
export const DEFAULT_KNOWLEDGE_BASE_SLUG = "general";

const ACTIVE_KNOWLEDGE_BASE_STORAGE_PREFIX = "mhs_active_kb";

export function normalizeKnowledgeBaseName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Knowledge base name is required");
  }
  return normalized.slice(0, 80);
}

export function slugifyKnowledgeBaseName(name: string): string {
  const slug = normalizeKnowledgeBaseName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || DEFAULT_KNOWLEDGE_BASE_SLUG;
}

export function generateKnowledgeBaseSlug(name: string, existingSlugs: Iterable<string>): string {
  const slugBase = slugifyKnowledgeBaseName(name);
  const taken = new Set(existingSlugs);

  if (!taken.has(slugBase)) {
    return slugBase;
  }

  let suffix = 2;
  let nextSlug = `${slugBase}-${suffix}`;
  while (taken.has(nextSlug)) {
    suffix += 1;
    nextSlug = `${slugBase}-${suffix}`;
  }

  return nextSlug;
}

function getActiveKnowledgeBaseStorageKey(mode: KnowledgeBaseMode): string {
  return `${ACTIVE_KNOWLEDGE_BASE_STORAGE_PREFIX}_${mode}`;
}

export function loadActiveKnowledgeBaseId(mode: KnowledgeBaseMode): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(getActiveKnowledgeBaseStorageKey(mode));
}

export function saveActiveKnowledgeBaseId(mode: KnowledgeBaseMode, knowledgeBaseId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getActiveKnowledgeBaseStorageKey(mode), knowledgeBaseId);
}
