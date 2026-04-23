"use client";

import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ExternalLink, FileText, BookOpen, Sparkles, Loader2, Play, Trash2, X, ChevronUp, StickyNote } from "lucide-react";
import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import type { MediaItem } from "@/lib/mock-data";
import { PlatformIcon } from "./PlatformIcon";
import { AIPanel } from "./shared/AIPanel";
import { parseTranscript } from "@/lib/parseTranscript";

interface MediaCardProps {
  item: MediaItem;
  index: number;
  onCategorize?: (id: string, transcriptUrl: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onGenerateTranscript?: (item: MediaItem) => Promise<void>;
  onGenerateNotes?: (item: MediaItem) => Promise<void>;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const FALLBACK_THUMBNAILS: Record<string, string> = {
  youtube: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=640&h=360&fit=crop",
  tiktok: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=640&h=360&fit=crop",
  instagram: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&h=360&fit=crop",
  vimeo: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=640&h=360&fit=crop",
  twitter: "https://images.unsplash.com/photo-1611162616475-46b635cbca44?w=640&h=360&fit=crop",
  unknown: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=640&h=360&fit=crop",
};

function getEmbedUrl(platform: string, videoId: string): string | null {
  if (platform === "youtube") return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  if (platform === "tiktok") return `https://www.tiktok.com/embed/v2/${videoId}`;
  if (platform === "vimeo") return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  if (platform === "instagram") return `https://www.instagram.com/p/${videoId}/embed`;
  return null;
}

const MediaCard = ({ item, onCategorize, onDelete, onGenerateTranscript, onGenerateNotes }: MediaCardProps) => {
  const thumbnail = (item.thumbnailUrl && item.thumbnailUrl.trim() !== "") 
    ? item.thumbnailUrl 
    : (FALLBACK_THUMBNAILS[item.platform] ?? FALLBACK_THUMBNAILS.unknown);
  const [isPending, startTransition] = useTransition();
  const [playing, setPlaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesContent, setNotesContent] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const embedUrl = getEmbedUrl(item.platform, item.videoId);
  const canEmbed = embedUrl !== null;

  const handlePlayClick = () => {
    if (canEmbed) {
      setPlaying(true);
    } else {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCategorize = () => {
    if (!item.transcriptUrl) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await onCategorize?.(item.id, item.transcriptUrl!);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to categorize");
        console.error("[Categorize]", err);
      }
    });
  };

  const handleSoftDelete = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await onDelete?.(item.id);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to hide item");
        console.error("[SoftDelete]", err);
      }
    });
  };

  const handleGenerateTranscript = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await onGenerateTranscript?.(item);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to generate transcript");
        console.error("[GenerateTranscript]", err);
      }
    });
  };

  const handleGenerateNotes = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await onGenerateNotes?.(item);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to generate notes");
        console.error("[GenerateNotes]", err);
      }
    });
  };

  const handleTranscriptClick = async () => {
    if (!transcriptOpen && transcriptContent === null) {
      setTranscriptLoading(true);
      try {
        const res = await fetch(item.transcriptUrl!);
        const text = await res.text();
        setTranscriptContent(text);
      } catch {
        setTranscriptContent('Failed to load transcript.');
      } finally {
        setTranscriptLoading(false);
      }
    }
    setTranscriptOpen(prev => !prev);
  };

  const handleNotesClick = async () => {
    if (!notesOpen && notesContent === null) {
      setNotesLoading(true);
      try {
        const res = await fetch(item.notesUrl!);
        const text = await res.text();
        setNotesContent(text);
      } catch {
        setNotesContent('Failed to load notes.');
      } finally {
        setNotesLoading(false);
      }
    }
    setNotesOpen(prev => !prev);
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: playing ? 0 : -4, transition: { duration: 0.2 } }}
      className={`group relative flex flex-col min-h-[280px] overflow-hidden rounded-xl border border-white/8 bg-white/3 transition-all duration-300 hover:border-primary/30 hover:shadow-[var(--shadow-glow)] ${
        aiPanelOpen || transcriptOpen || notesOpen ? 'row-span-2' : ''
      }`}
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video shrink-0 overflow-hidden bg-black">
        {playing && embedUrl ? (
          <>
            <iframe
              src={embedUrl}
              title={item.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
            <button
              onClick={() => setPlaying(false)}
              aria-label="Close player"
              className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <Image
              src={thumbnail}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Play button overlay */}
            <button
              onClick={handlePlayClick}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform duration-150 hover:scale-110">
                <Play size={20} fill="white" />
              </span>
            </button>

            <div className="absolute bottom-3 left-3">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open on ${item.platform}`}
                onClick={(e) => e.stopPropagation()}
              >
                <PlatformIcon platform={item.platform} />
              </a>
            </div>
            {item.category && (
              <div className="absolute top-3 right-3 rounded-md bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
                {item.category}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content / Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-heading text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {item.title}
          </h3>
          {item.authorName && (
            <p className="mt-1 text-xs text-muted-foreground">{item.authorName}</p>
          )}
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {actionError && <p className="text-xs text-destructive">{actionError}</p>}
      </div>

      {/* Accordions */}
      <AnimatePresence>
        {/* AI Panel Accordion */}
        {aiPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-4 border-t border-emerald-500/15" />
            <AIPanel
              transcriptUrl={item.transcriptUrl}
              notesUrl={item.notesUrl}
              videoUrl={item.url}
              title={item.title}
              enabled={aiPanelOpen}
              variant="card"
            />
            {/* Panel-specific Footer Actions */}
            <div className="px-4 pb-4 flex justify-end gap-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors">
                  <Play size={11} fill="currentColor" /> Watch Video
                </button>
              </a>
            </div>
          </motion.div>
        )}

        {/* Transcript Accordion */}
        {transcriptOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-4 border-t border-white/8 pt-3 pb-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">
                Transcript
              </p>

              {transcriptLoading && (
                <div className="space-y-1.5">
                  {[100, 85, 90, 75].map((w, i) => (
                    <div key={i} className="h-2.5 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {!transcriptLoading && transcriptContent && (
                <div className="overflow-y-auto max-h-[220px] space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                  {parseTranscript(transcriptContent).map((line, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-relaxed">
                      {line.timestamp && (
                        <span className="shrink-0 font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] h-fit mt-0.5">
                          {line.timestamp}
                        </span>
                      )}
                      <span className="text-white/60">{line.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Notes Accordion */}
        {notesOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-4 border-t border-white/8 pt-3 pb-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">
                Notes
              </p>

              {notesLoading && (
                <div className="space-y-1.5">
                  {[100, 80, 90, 70, 85].map((w, i) => (
                    <div key={i} className="h-2.5 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {!notesLoading && notesContent && (
                <div className="overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-white/10">
                  <div className="prose prose-invert prose-xs text-white/65 leading-relaxed">
                    <ReactMarkdown>{notesContent}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer — always last */}
      <div className="shrink-0 px-4 py-3 border-t border-white/8 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Ask AI button — only when transcript and notes exist */}
          {item.transcriptUrl && item.notesUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setAiPanelOpen(prev => !prev)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                aiPanelOpen
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                  : "border-emerald-500/20 text-emerald-400/50 hover:border-emerald-400/40 hover:text-emerald-300"
              }`}
            >
              <Sparkles size={11} />
              {aiPanelOpen ? "Close" : "Ask AI"}
            </motion.button>
          )}

          {/* Transcript button */}
          {item.transcriptUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleTranscriptClick}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                transcriptOpen
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                  : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
              }`}
            >
              <FileText size={11} />
              Transcript
            </motion.button>
          )}

          {/* Notes button */}
          {item.notesUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleNotesClick}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                notesOpen
                  ? "bg-blue-500/20 border-blue-400/50 text-blue-300"
                  : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
              }`}
            >
              <BookOpen size={11} />
              Notes
            </motion.button>
          )}

          {/* Generation buttons (if needed) */}
          {!item.transcriptUrl && onGenerateTranscript && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleGenerateTranscript}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              Generate Transcript
            </motion.button>
          )}
          {!item.notesUrl && item.transcriptUrl && onGenerateNotes && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleGenerateNotes}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <StickyNote size={11} />}
              Generate Notes
            </motion.button>
          )}
        </div>

        <button
          onClick={handleSoftDelete}
          title="Hide item"
          disabled={isPending}
          className="p-1.5 shrink-0 rounded-md text-white/25 hover:text-red-400/70 hover:bg-red-500/10 transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </motion.div>
  );
};

export default MediaCard;
