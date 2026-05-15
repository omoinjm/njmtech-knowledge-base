"use client";

import { useState, useCallback, useTransition, useMemo, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpenText, LayoutGrid, Network, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import AddUrlBar from "@/components/AddUrlBar";
import MediaCard from "@/components/MediaCard";
import PublicModeSettings from "@/components/PublicModeSettings";
import { Input } from "@/components/ui/input";
import {
  addMediaItem,
  answerTranscriptQuestion,
  categorizeItem,
  categorizeTranscriptAction,
  createKnowledgeBase,
  generatePublicNotes,
  generatePublicTranscript,
  generateTranscriptQuestions,
  getKnowledgeBaseState,
  getMediaItemById,
  preparePublicMediaItem,
  softDeleteMediaItem,
} from "@/app/actions";
import type { KnowledgeBase, MediaItem } from "@/types/media";
import type { GuestConfig } from "@/lib/guest-config";
import { loadActiveKnowledgeBaseId, saveActiveKnowledgeBaseId } from "@/lib/knowledge-bases";
import {
  createPublicKnowledgeBase,
  loadPublicKnowledgeBases,
  loadPublicMediaItems,
  softDeletePublicMediaItem,
  updatePublicMediaCategory,
  updatePublicMediaItem,
  upsertPublicMediaItem,
} from "@/lib/public-media-storage";
import { storeBrowserBlob } from "@/lib/browser-blob-storage";
import { getNotesProviderLabel, getTranscribeProviderLabel } from "@/lib/guest-config";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const GraphView = dynamic(() => import("@/components/GraphView/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-250px)] w-full items-center justify-center rounded-xl border border-border bg-background/50">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading graph...</p>
      </div>
    </div>
  ),
});

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 15;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface MediaDashboardProps {
  initialItems: MediaItem[];
  initialKnowledgeBases?: KnowledgeBase[];
  initialKnowledgeBaseId?: string;
  mode: "personal" | "public";
}

export default function MediaDashboard({
  initialItems,
  initialKnowledgeBases = [],
  initialKnowledgeBaseId,
  mode,
}: MediaDashboardProps) {
  const [personalItems, setPersonalItems] = useState<MediaItem[]>(initialItems);
  const [publicItems, setPublicItems] = useState<MediaItem[]>([]);
  const [personalKnowledgeBases, setPersonalKnowledgeBases] = useState<KnowledgeBase[]>(initialKnowledgeBases);
  const [publicKnowledgeBases, setPublicKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState(initialKnowledgeBaseId ?? "");
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState("");
  const [publicConfig, setPublicConfig] = useState<GuestConfig | null>(null);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("All");
  const [viewMode, setViewMode] = useViewMode("grid");
  const pollingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const restoredKnowledgeBaseRef = useRef(false);

  const knowledgeBases = mode === "personal" ? personalKnowledgeBases : publicKnowledgeBases;
  const items = mode === "personal" ? personalItems : publicItems;
  const activeKnowledgeBase = useMemo(
    () => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === activeKnowledgeBaseId) ?? knowledgeBases[0] ?? null,
    [activeKnowledgeBaseId, knowledgeBases],
  );

  const upsertPersonalItem = useCallback((nextItem: MediaItem) => {
    setPersonalItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === nextItem.id);
      if (existingIndex === -1) {
        return [nextItem, ...prev];
      }

      const nextItems = [...prev];
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        ...nextItem,
      };

      return nextItems;
    });
  }, []);

  const updatePersonalItem = useCallback((id: string, patch: Partial<MediaItem>) => {
    setPersonalItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const pollForCategory = useCallback(
    (id: string, attempt = 1) => {
      const timer = setTimeout(async () => {
        pollingTimers.current.delete(id);
        const item = await getMediaItemById(id);
        if (item?.category) {
          updatePersonalItem(id, {
            category: item.category,
            tags: item.tags,
            title: item.title,
          });
        } else if (attempt < POLL_MAX_ATTEMPTS) {
          pollForCategory(id, attempt + 1);
        }
      }, POLL_INTERVAL_MS);
      pollingTimers.current.set(id, timer);
    },
    [updatePersonalItem],
  );

  useEffect(() => {
    let cancelled = false;

    if (mode !== "public") {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const storedKnowledgeBases = await loadPublicKnowledgeBases();
      const storedActiveId = loadActiveKnowledgeBaseId("public");
      const nextActiveKnowledgeBase =
        storedKnowledgeBases.find((knowledgeBase) => knowledgeBase.id === storedActiveId)
        ?? storedKnowledgeBases[0]
        ?? null;

      if (!nextActiveKnowledgeBase || cancelled) {
        return;
      }

      const nextItems = await loadPublicMediaItems(nextActiveKnowledgeBase.id);
      if (cancelled) {
        return;
      }

      setPublicKnowledgeBases(storedKnowledgeBases);
      setPublicItems(nextItems);
      setActiveKnowledgeBaseId(nextActiveKnowledgeBase.id);
      saveActiveKnowledgeBaseId("public", nextActiveKnowledgeBase.id);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    if (mode !== "personal" || restoredKnowledgeBaseRef.current || personalKnowledgeBases.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    restoredKnowledgeBaseRef.current = true;

    const storedKnowledgeBaseId = loadActiveKnowledgeBaseId("personal");
    const fallbackKnowledgeBaseId = initialKnowledgeBaseId ?? personalKnowledgeBases[0]?.id ?? "";

    if (!storedKnowledgeBaseId || storedKnowledgeBaseId === fallbackKnowledgeBaseId) {
      setActiveKnowledgeBaseId(fallbackKnowledgeBaseId);
      saveActiveKnowledgeBaseId("personal", fallbackKnowledgeBaseId);
      return () => {
        cancelled = true;
      };
    }

    startTransition(async () => {
      const state = await getKnowledgeBaseState(storedKnowledgeBaseId);
      if (cancelled) {
        return;
      }

      setPersonalKnowledgeBases(state.knowledgeBases);
      setPersonalItems(state.items);
      setActiveKnowledgeBaseId(state.activeKnowledgeBase.id);
      saveActiveKnowledgeBaseId("personal", state.activeKnowledgeBase.id);
    });

    return () => {
      cancelled = true;
    };
  }, [initialKnowledgeBaseId, mode, personalKnowledgeBases]);

  useEffect(() => {
    return () => {
      for (const timer of pollingTimers.current.values()) {
        clearTimeout(timer);
      }
      pollingTimers.current.clear();
    };
  }, []);

  const handleConfigChange = useCallback((config: GuestConfig | null) => {
    setPublicConfig(config);
    setHasSavedConfig(config !== null);
  }, []);

  const handleKnowledgeBaseChange = useCallback(
    (knowledgeBaseId: string) => {
      setError(null);
      setActiveTab("All");

      startTransition(async () => {
        if (mode === "personal") {
          const state = await getKnowledgeBaseState(knowledgeBaseId);
          setPersonalKnowledgeBases(state.knowledgeBases);
          setPersonalItems(state.items);
          setActiveKnowledgeBaseId(state.activeKnowledgeBase.id);
          saveActiveKnowledgeBaseId("personal", state.activeKnowledgeBase.id);
          return;
        }

        setActiveKnowledgeBaseId(knowledgeBaseId);
        setPublicItems(await loadPublicMediaItems(knowledgeBaseId));
        saveActiveKnowledgeBaseId("public", knowledgeBaseId);
      });
    },
    [mode],
  );

  const handleCreateKnowledgeBase = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!newKnowledgeBaseName.trim() || isPending) {
        return;
      }

      setError(null);
      setActiveTab("All");

      startTransition(async () => {
        if (mode === "personal") {
          const result = await createKnowledgeBase(newKnowledgeBaseName);
          if (!result.success || !result.data) {
            setError(result.error ?? "Failed to create knowledge base");
            return;
          }

          setPersonalKnowledgeBases(result.data.knowledgeBases);
          setPersonalItems(result.data.items);
          setActiveKnowledgeBaseId(result.data.activeKnowledgeBase.id);
          saveActiveKnowledgeBaseId("personal", result.data.activeKnowledgeBase.id);
          setNewKnowledgeBaseName("");
          return;
        }

        try {
          const result = await createPublicKnowledgeBase(newKnowledgeBaseName);
          setPublicKnowledgeBases(result.knowledgeBases);
          setPublicItems([]);
          setActiveKnowledgeBaseId(result.knowledgeBase.id);
          saveActiveKnowledgeBaseId("public", result.knowledgeBase.id);
          setNewKnowledgeBaseName("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create knowledge base");
        }
      });
    },
    [isPending, mode, newKnowledgeBaseName],
  );

  const handleAdd = useCallback(
    (url: string) => {
      if (!activeKnowledgeBase) {
        setError("Create or select a knowledge base first");
        return;
      }

      setError(null);
      startTransition(async () => {
        if (mode === "personal") {
          const result = await addMediaItem(url, activeKnowledgeBase.id);
          if (result.success && result.data?.item) {
            const item = result.data.item;
            upsertPersonalItem(item);
            if (item.transcriptUrl && !item.category) {
              pollForCategory(item.id);
            }
          } else {
            setError(result.error ?? "Something went wrong");
          }
          return;
        }

        const result = await preparePublicMediaItem(url, activeKnowledgeBase.id);
        if (!result.success || !result.data?.item) {
          setError(result.error ?? "Something went wrong");
          return;
        }

        const { item, items: nextItems } = await upsertPublicMediaItem(result.data.item, activeKnowledgeBase.id);
        setPublicItems(nextItems);

        if (item.transcriptUrl && !item.category) {
          const categoryResult = await categorizeTranscriptAction(item.transcriptUrl);
          if (categoryResult.success && categoryResult.data) {
            setPublicItems(
              await updatePublicMediaCategory(
                item.id,
                activeKnowledgeBase.id,
                categoryResult.data.category,
                categoryResult.data.tags ?? [],
              ),
            );
          }
        }
      });
    },
    [activeKnowledgeBase, mode, pollForCategory, upsertPersonalItem],
  );

  const handleCategorize = useCallback(
    async (id: string, transcriptUrl: string) => {
      if (mode === "personal") {
        const result = await categorizeItem(id, transcriptUrl);
        if (!result.success || !result.data?.category) {
          throw new Error(result.error ?? "Failed to categorize media item");
        }
        updatePersonalItem(id, {
          category: result.data.category,
          tags: result.data.tags ?? [],
          title: result.data.title,
        });
        return;
      }

      if (!activeKnowledgeBase) {
        throw new Error("Create or select a knowledge base first");
      }

      const result = await categorizeTranscriptAction(transcriptUrl);
      if (!result.success || !result.data?.category) {
        throw new Error(result.error ?? "Failed to categorize media item");
      }
      setPublicItems(
        await updatePublicMediaCategory(
          id,
          activeKnowledgeBase.id,
          result.data.category,
          result.data.tags ?? [],
          result.data.title,
        ),
      );
    },
    [activeKnowledgeBase, mode, updatePersonalItem],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const timer = pollingTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        pollingTimers.current.delete(id);
      }

      if (mode === "personal") {
        const result = await softDeleteMediaItem(id);
        if (!result.success) {
          throw new Error(result.error ?? "Failed to hide media item");
        }
        setPersonalItems((prev) => prev.filter((item) => item.id !== id));
        return;
      }

      if (!activeKnowledgeBase) {
        throw new Error("Create or select a knowledge base first");
      }

      setPublicItems(await softDeletePublicMediaItem(id, activeKnowledgeBase.id));
    },
    [activeKnowledgeBase, mode],
  );

  const handleGenerateTranscript = useCallback(
    async (item: MediaItem) => {
      if (mode !== "public") return;
      if (!activeKnowledgeBase) {
        throw new Error("Create or select a knowledge base first");
      }
      if (!publicConfig) {
        throw new Error("Set up public mode settings first");
      }
      if (publicConfig.transcribeProvider === "openai" && !publicConfig.transcribeApiKey.trim()) {
        throw new Error("OpenAI API key is required. Add it in Public mode settings.");
      }

      const result = await generatePublicTranscript({
        item: {
          id: item.id,
          url: item.url,
          platform: item.platform,
          videoId: item.videoId,
          title: item.title,
        },
        config: {
          transcribeProvider: publicConfig.transcribeProvider,
          transcribeApiKey: publicConfig.transcribeApiKey,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Failed to generate transcript");
      }

      const transcriptUrl = await storeBrowserBlob(
        item.platform,
        item.videoId,
        "txt",
        result.data,
      );

      let nextItems = await updatePublicMediaItem(item.id, activeKnowledgeBase.id, { transcriptUrl });
      const categoryResult = await categorizeTranscriptAction(transcriptUrl);
      if (categoryResult.success && categoryResult.data) {
        nextItems = await updatePublicMediaCategory(
          item.id,
          activeKnowledgeBase.id,
          categoryResult.data.category,
          categoryResult.data.tags ?? [],
        );
      }
      setPublicItems(nextItems);
    },
    [activeKnowledgeBase, mode, publicConfig],
  );

  const handleGenerateNotes = useCallback(
    async (item: MediaItem) => {
      if (mode !== "public") return;
      if (!activeKnowledgeBase) {
        throw new Error("Create or select a knowledge base first");
      }
      if (!publicConfig) {
        throw new Error("Set up public mode settings first");
      }
      if (!item.transcriptUrl) {
        throw new Error("Transcript is required before generating notes");
      }
      if (!publicConfig.llmApiKey.trim()) {
        throw new Error(`${
          publicConfig.llmProvider === "openai"
            ? "OpenAI"
            : publicConfig.llmProvider === "groq"
              ? "Groq"
              : "Anthropic"
        } API key is required. Add it in Public mode settings.`);
      }

      const transcriptRes = await fetch(item.transcriptUrl);
      if (!transcriptRes.ok) {
        throw new Error("Failed to fetch transcript content");
      }
      const transcriptContent = await transcriptRes.text();

      const result = await generatePublicNotes({
        item: {
          id: item.id,
          platform: item.platform,
          videoId: item.videoId,
          transcriptUrl: item.transcriptUrl,
          title: item.title,
        },
        config: {
          llmProvider: publicConfig.llmProvider,
          llmApiKey: publicConfig.llmApiKey,
          llmModel: publicConfig.llmModel,
        },
        transcriptContent,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Failed to generate notes");
      }

      const notesUrl = await storeBrowserBlob(
        item.platform,
        item.videoId,
        "md",
        result.data,
      );

      setPublicItems(await updatePublicMediaItem(item.id, activeKnowledgeBase.id, { notesUrl }));
    },
    [activeKnowledgeBase, mode, publicConfig],
  );

  const tabs = useMemo(() => {
    const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean) as string[])).sort();
    return ["All", ...categories];
  }, [items]);

  const filteredItems = useMemo(
    () => (activeTab === "All" ? items : items.filter((item) => item.category === activeTab)),
    [items, activeTab],
  );

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab("All");
    }
  }, [activeTab, tabs]);

  const knowledgeBaseSummary = activeKnowledgeBase
    ? `${activeKnowledgeBase.name} · ${items.length} item${items.length === 1 ? "" : "s"}`
    : "Select a knowledge base";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <LayoutGrid size={16} className="text-primary-foreground" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              njmtech<span className="text-primary">.media</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-lg border border-border bg-background/50 p-1 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                aria-label="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                  viewMode === "graph"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                aria-label="Graph View"
              >
                <Network size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {mode === "public" && <PublicModeSettings onConfigChange={handleConfigChange} />}
              <span className="hidden text-xs text-muted-foreground sm:block">
                {knowledgeBases.length} knowledge base{knowledgeBases.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pt-10 pb-16 lg:grid-cols-[300px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/80 shadow-[0_18px_70px_-42px_rgba(15,23,42,0.55)] backdrop-blur">
            <div className="border-b border-border/70 bg-gradient-to-br from-primary/12 via-transparent to-transparent px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <BookOpenText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Knowledge bases
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">{knowledgeBaseSummary}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Each knowledge base keeps its own media, categories, and URL deduping. The same link can live in multiple knowledge bases.
              </p>
            </div>

            <div className="space-y-3 px-3 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col">
                {knowledgeBases.map((knowledgeBase) => {
                  const isActive = activeKnowledgeBase?.id === knowledgeBase.id;
                  return (
                    <button
                      key={knowledgeBase.id}
                      type="button"
                      onClick={() => handleKnowledgeBaseChange(knowledgeBase.id)}
                      disabled={isPending}
                      className={cn(
                        "relative min-w-[220px] shrink-0 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-0",
                        isActive
                          ? "border-primary/30 bg-primary text-primary-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.95)]"
                          : "border-border/70 bg-background/70 text-foreground hover:border-primary/30 hover:bg-accent/40",
                      )}
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="active-knowledge-base-tab"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_42%)]"
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        />
                      )}
                      <span className="relative z-10 block truncate text-sm font-semibold">{knowledgeBase.name}</span>
                      <span
                        className={cn(
                          "relative z-10 mt-1 block truncate text-[11px] uppercase tracking-[0.22em]",
                          isActive ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {knowledgeBase.slug}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCreateKnowledgeBase} className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Create a new base
                </p>
                <div className="flex flex-col gap-2">
                  <Input
                    value={newKnowledgeBaseName}
                    onChange={(event) => setNewKnowledgeBaseName(event.target.value)}
                    placeholder="e.g. Hiring, onboarding, support"
                    maxLength={80}
                    disabled={isPending}
                    className="h-11 border-border/70 bg-background"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !newKnowledgeBaseName.trim()}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={16} />
                    Create knowledge base
                  </button>
                </div>
              </form>
            </div>
          </div>
        </motion.aside>

        <div className="min-w-0">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col gap-4 pb-8"
          >
            <div className="space-y-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">Media Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {mode === "personal"
                  ? "Personal mode saves items in the shared app database."
                  : "Public mode keeps items in encrypted browser storage and does not write media records to the server database."}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2">
              <AddUrlBar onAdd={handleAdd} isLoading={isPending || !activeKnowledgeBase} />
              {mode === "public" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {publicConfig
                      ? "Public users can choose their own transcript and notes providers from Public settings."
                      : "Add URLs now, then open Public settings to choose providers and add tokens for transcript and notes generation."}
                  </p>
                  {publicConfig && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                        Transcript: {getTranscribeProviderLabel(publicConfig.transcribeProvider)}
                      </span>
                      <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                        Notes: {getNotesProviderLabel(publicConfig.llmProvider)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </motion.section>

          {tabs.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="pb-6"
            >
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {tabs.map((tab) => {
                  const count = tab === "All" ? items.length : items.filter((item) => item.category === tab).length;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="active-tab-pill"
                          className="absolute inset-0 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className={`relative z-10 ${isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        {tab}
                        <span className={`ml-1.5 text-xs ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                          {count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          <main>
            <AnimatePresence mode="wait">
              {viewMode === "grid" ? (
                <motion.div
                  key={`${mode}-${activeKnowledgeBaseId}-${activeTab}-grid`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  {filteredItems.length === 0 ? (
                    <div className="py-16 text-center">
                      {mode === "public" && !hasSavedConfig ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Welcome to Public mode! This dashboard stores media locally in your browser.
                          </p>
                          <p className="mx-auto max-w-md text-xs text-muted-foreground">
                            <strong>Transcripts & Notes:</strong> Optional. Set up API credentials in settings to generate transcripts and AI notes.
                          </p>
                          <p className="mx-auto max-w-md text-xs text-muted-foreground">
                            <strong>View-only:</strong> You can add media and manage them without any setup.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {activeKnowledgeBase
                            ? `No items in ${activeKnowledgeBase.name}${activeTab === "All" ? " yet." : ` for ${activeTab} yet.`}`
                            : "Create a knowledge base to get started."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid-auto-rows-min grid-flow-dense grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                    >
                      {filteredItems.map((item, index) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          index={index}
                          onCategorize={handleCategorize}
                          onDelete={handleDelete}
                          onGenerateTranscript={mode === "public" ? handleGenerateTranscript : undefined}
                          onGenerateNotes={mode === "public" ? handleGenerateNotes : undefined}
                          onGenerateQuestions={generateTranscriptQuestions}
                          onAnswerQuestion={answerTranscriptQuestion}
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`${mode}-${activeKnowledgeBaseId}-${activeTab}-graph`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <GraphView
                    items={filteredItems}
                    onCategorize={handleCategorize}
                    onDelete={handleDelete}
                    onGenerateTranscript={mode === "public" ? handleGenerateTranscript : undefined}
                    onGenerateNotes={mode === "public" ? handleGenerateNotes : undefined}
                    onGenerateQuestions={generateTranscriptQuestions}
                    onAnswerQuestion={answerTranscriptQuestion}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
