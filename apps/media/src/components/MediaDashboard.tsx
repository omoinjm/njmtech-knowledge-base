"use client";

import { useState, useCallback, useTransition, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import AddUrlBar from "@/components/AddUrlBar";
import MediaCard from "@/components/MediaCard";
import PublicModeSettings from "@/components/PublicModeSettings";
import {
  addMediaItem,
  categorizeItem,
  categorizeTranscriptAction,
  generatePublicNotes,
  generatePublicTranscript,
  getMediaItemById,
  preparePublicMediaItem,
  softDeleteMediaItem,
} from "@/app/actions";
import type { MediaItem } from "@/lib/mock-data";
import type { GuestConfig } from "@/lib/guest-config";
import {
  loadPublicMediaItems,
  softDeletePublicMediaItem,
  updatePublicMediaItem,
  updatePublicMediaCategory,
  upsertPublicMediaItem,
} from "@/lib/public-media-storage";
import { storeBrowserBlob } from "@/lib/browser-blob-storage";
import { getNotesProviderLabel, getTranscribeProviderLabel } from "@/lib/guest-config";

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 15;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface MediaDashboardProps {
  initialItems: MediaItem[];
  mode: "personal" | "public";
}

export default function MediaDashboard({ initialItems, mode }: MediaDashboardProps) {
  const [personalItems, setPersonalItems] = useState<MediaItem[]>(initialItems);
  const [publicItems, setPublicItems] = useState<MediaItem[]>([]);
  const [publicConfig, setPublicConfig] = useState<GuestConfig | null>(null);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("All");
  const pollingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const items = mode === "personal" ? personalItems : publicItems;

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
    [updatePersonalItem]
  );

  useEffect(() => {
    if (mode === "public") {
      loadPublicMediaItems().then(setPublicItems);
    }
  }, [mode]);

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

  const handleAdd = useCallback(
    (url: string) => {
      setError(null);
      startTransition(async () => {
        if (mode === "personal") {
          const result = await addMediaItem(url);
          if (result.success && result.item) {
            setPersonalItems((prev) => {
              const exists = prev.some((item) => item.id === result.item!.id);
              return exists ? prev : [result.item!, ...prev];
            });
            if (result.item.transcriptUrl && !result.item.category) {
              pollForCategory(result.item.id);
            }
          } else {
            setError(result.error ?? "Something went wrong");
          }
          return;
        }

        const result = await preparePublicMediaItem(url);
        if (!result.success || !result.item) {
          setError(result.error ?? "Something went wrong");
          return;
        }

        const { item, items: nextItems } = await upsertPublicMediaItem(result.item);
        setPublicItems(nextItems);

        if (item.transcriptUrl && !item.category) {
          const categoryResult = await categorizeTranscriptAction(item.transcriptUrl);
          if (categoryResult.success && categoryResult.category) {
            setPublicItems(
              await updatePublicMediaCategory(item.id, categoryResult.category, categoryResult.tags ?? [])
            );
          }
        }
      });
    },
    [mode, pollForCategory, publicConfig]
  );

  const handleCategorize = useCallback(
    async (id: string, transcriptUrl: string) => {
      if (mode === "personal") {
        const result = await categorizeItem(id, transcriptUrl);
        if (!result.success || !result.category) {
          throw new Error(result.error ?? "Failed to categorize media item");
        }
        updatePersonalItem(id, {
          category: result.category,
          tags: result.tags ?? [],
          title: result.title,
        });
        return;
      }

      const result = await categorizeTranscriptAction(transcriptUrl);
      if (!result.success || !result.category) {
        throw new Error(result.error ?? "Failed to categorize media item");
      }
      setPublicItems(
        await updatePublicMediaCategory(
          id,
          result.category,
          result.tags ?? [],
          result.title
        )
      );
    },
    [mode, updatePersonalItem]
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

      setPublicItems(await softDeletePublicMediaItem(id));
    },
    [mode]
  );

  const handleGenerateTranscript = useCallback(
    async (item: MediaItem) => {
      if (mode !== "public") return;
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

      if (!result.success || !result.transcriptContent) {
        throw new Error(result.error ?? "Failed to generate transcript");
      }

      // Store transcript in browser blob storage
      const transcriptUrl = await storeBrowserBlob(
        item.platform,
        item.videoId,
        "txt",
        result.transcriptContent
      );

      let nextItems = await updatePublicMediaItem(item.id, { transcriptUrl });
      const categoryResult = await categorizeTranscriptAction(transcriptUrl);
      if (categoryResult.success && categoryResult.category) {
        nextItems = await updatePublicMediaCategory(
          item.id,
          categoryResult.category,
          categoryResult.tags ?? []
        );
      }
      setPublicItems(nextItems);
    },
    [mode, publicConfig]
  );

  const handleGenerateNotes = useCallback(
    async (item: MediaItem) => {
      if (mode !== "public") return;
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

      // Fetch transcript content from data URL
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

      if (!result.success || !result.notesContent) {
        throw new Error(result.error ?? "Failed to generate notes");
      }

      // Store notes in browser blob storage
      const notesUrl = await storeBrowserBlob(
        item.platform,
        item.videoId,
        "md",
        result.notesContent
      );

      setPublicItems(await updatePublicMediaItem(item.id, { notesUrl }));
    },
    [mode, publicConfig]
  );

  const tabs = useMemo(() => {
    const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean) as string[])).sort();
    return ["All", ...categories];
  }, [items]);

  const filteredItems = useMemo(
    () => (activeTab === "All" ? items : items.filter((item) => item.category === activeTab)),
    [items, activeTab]
  );

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab("All");
    }
  }, [activeTab, tabs]);

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex items-center gap-3">
            {mode === "public" && <PublicModeSettings onConfigChange={handleConfigChange} />}
            <span className="hidden text-xs text-muted-foreground sm:block">{items.length} items</span>
          </div>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 pt-12 pb-8"
      >
        <h1 className="font-heading text-2xl font-bold text-foreground">Media Dashboard</h1>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "personal"
            ? "Personal mode saves items in the shared app database."
            : "Public mode keeps items in encrypted browser storage and does not write media records to the server database."}
        </p>
        <div className="mt-4 flex w-full flex-col items-center gap-2">
          <AddUrlBar onAdd={handleAdd} isLoading={isPending} />
          {mode === "public" && (
            <>
              <p className="text-center text-xs text-muted-foreground">
                {publicConfig
                  ? "Public users can choose their own transcript and notes providers from Public settings."
                  : "Add URLs now, then open Public settings to choose providers and add tokens for transcript and notes generation."}
              </p>
              {publicConfig && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
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
          className="mx-auto max-w-7xl px-6 pb-6"
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

      <main className="mx-auto max-w-7xl px-6 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${activeTab}`}
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
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      <strong>Transcripts & Notes:</strong> Optional. Set up API credentials in settings to generate transcripts and AI notes.
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      <strong>View-only:</strong> You can add media and manage them without any setup.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {mode === "public" ? "No public items saved in this browser yet." : "No items in this category yet."}
                  </p>
                )}
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
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
                   />
                 ))}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
