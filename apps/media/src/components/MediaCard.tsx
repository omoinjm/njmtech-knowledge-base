"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Loader2, Play, Trash2, X, FileText, BookOpen, Sparkles, StickyNote } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MediaItem } from "@/types/media";
import { PlatformIcon } from "./PlatformIcon";
import { AIPanel } from "./shared/AIPanel";
import { parseTranscript } from "@/lib/parseTranscript";

/**
 * Prop interface for the MediaCard component.
 */
export interface MediaCardProps {
  /** The media item data to display */
  item: MediaItem;
  /** Index for staggered animation entry */
  index: number;
  /** Callback to trigger AI categorization */
  onCategorize?: (id: string, transcriptUrl: string) => Promise<void>;
  /** Callback to soft-delete the item */
  onDelete?: (id: string) => Promise<void>;
  /** Callback to generate a transcript for public items */
  onGenerateTranscript?: (item: MediaItem) => Promise<void>;
  /** Callback to generate notes for public items */
  onGenerateNotes?: (item: MediaItem) => Promise<void>;
  /** Injected server action for AI question generation */
  onGenerateQuestions: (transcript: string, title: string) => Promise<string[]>;
  /** Injected server action for AI question answering */
  onAnswerQuestion: (question: string, transcript: string, title: string) => Promise<string>;
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
} as const;

function getEmbedUrl(platform: string, videoId: string): string | null {
  if (platform === "youtube") return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  if (platform === "tiktok") return `https://www.tiktok.com/embed/v2/${videoId}`;
  if (platform === "vimeo") return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  if (platform === "instagram") return `https://www.instagram.com/p/${videoId}/embed`;
  return null;
}

/**
 * A card component that displays media item information, supports inline video playback,
 * and provides access to AI analysis tools (transcript, notes, Q&A).
 */
export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onCategorize,
  onDelete,
  onGenerateTranscript,
  onGenerateNotes,
  onGenerateQuestions,
  onAnswerQuestion,
}) => {
  const thumbnail = (item.thumbnailUrl && item.thumbnailUrl.trim() !== "") 
    ? item.thumbnailUrl 
    : (FALLBACK_THUMBNAILS[item.platform as keyof typeof FALLBACK_THUMBNAILS] ?? FALLBACK_THUMBNAILS.unknown);
    
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
  const [transcriptViewMode, setTranscriptViewMode] = useState<"summarized" | "raw">("summarized");

  const embedUrl = getEmbedUrl(item.platform, item.videoId);
  const canEmbed = embedUrl !== null;

  const handlePlayClick = () => {
    if (canEmbed) {
      setPlaying(true);
    } else {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleSoftDelete = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await onDelete?.(item.id);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to hide item");
      }
    });
  };

  const handleTranscriptClick = async () => {
    if (!transcriptOpen && transcriptContent === null && item.transcriptUrl) {
      setTranscriptLoading(true);
      try {
        const res = await fetch(item.transcriptUrl);
        const text = await res.text();
        setTranscriptContent(text);
      } catch {
        setTranscriptContent('Failed to load transcript.');
      } finally {
        setTranscriptLoading(false);
      }
    }
    
    // Also fetch notes for summary if not already loaded
    if (!transcriptOpen && notesContent === null && item.notesUrl) {
      setNotesLoading(true);
      try {
        const res = await fetch(item.notesUrl);
        const text = await res.text();
        setNotesContent(text);
      } catch {
        // Silent fail for summary
      } finally {
        setNotesLoading(false);
      }
    }

    setTranscriptOpen(prev => !prev);
  };

  const handleNotesClick = async () => {
    if (!notesOpen && notesContent === null && item.notesUrl) {
      setNotesLoading(true);
      try {
        const res = await fetch(item.notesUrl);
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

  // Extract summary components from notes if available - more flexible regex for headings
  const transcriptSummary = notesContent 
    ? (notesContent.match(/#+ Summary\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim()) 
    : null;
  const keyMoments = notesContent
    ? (notesContent.match(/#+ Key Moments\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim())
    : null;
  const keyPoints = notesContent
    ? (notesContent.match(/#+ Key Points\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim())
    : null;

  // Combine for summarized view
  let summarizedContent = [
    transcriptSummary ? `### Summary\n${transcriptSummary}` : null,
    keyMoments ? `### Key Moments\n${keyMoments}` : null,
    keyPoints ? `### Key Takeaways\n${keyPoints}` : null,
  ].filter(Boolean).join("\n\n");

  // Fallback: If we have notes but couldn't extract specific sections, show the full note
  if (!summarizedContent && notesContent) {
    summarizedContent = notesContent;
  }

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
              <a href={item.url} target="_blank" rel="noopener noreferrer">
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

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {actionError && <p className="text-xs text-destructive">{actionError}</p>}
      </div>

      {/* Accordions */}
      <AnimatePresence>
        {aiPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
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
              onGenerateQuestions={onGenerateQuestions}
              onAnswerQuestion={onAnswerQuestion}
            />
          </motion.div>
        )}

        {transcriptOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 border-t border-white/8 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Transcript</p>
                <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                  <button 
                    onClick={() => setTranscriptViewMode("summarized")}
                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${transcriptViewMode === "summarized" ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-white/40 hover:text-white/60"}`}
                  >
                    Summarized
                  </button>
                  <button 
                    onClick={() => setTranscriptViewMode("raw")}
                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${transcriptViewMode === "raw" ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-white/40 hover:text-white/60"}`}
                  >
                    Raw
                  </button>
                </div>
              </div>

              {transcriptLoading ? (
                <div className="space-y-1.5 animate-pulse">
                  {[100, 85, 90, 75].map((w, i) => <div key={i} className="h-2.5 bg-white/5 rounded" style={{ width: `${w}%` }} />)}
                </div>
              ) : transcriptViewMode === "summarized" ? (
                <div className="prose prose-invert prose-xs pr-2">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => {
                        // Regex to find timestamps like (00:00) or (00:00-00:00)
                        const content = React.Children.toArray(children).map(child => {
                          if (typeof child === 'string') {
                            const parts = child.split(/(\(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\))/g);
                            return parts.map((part, i) => {
                              if (part.match(/\(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\)/)) {
                                return <span key={i} className="text-emerald-400 font-mono font-medium">{part}</span>;
                              }
                              return part;
                            });
                          }
                          return child;
                        });
                        return <p className="mb-2 leading-relaxed text-white/70">{content}</p>;
                      },
                      h3: ({ children }) => <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] mt-4 mb-2">{children}</h3>
                    }}
                  >
                    {summarizedContent || "_No summary available yet. Try generating notes._"}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[220px] space-y-1 scrollbar-thin">
                  {parseTranscript(transcriptContent || "").map((line, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-relaxed">
                      {line.timestamp && <span className="shrink-0 font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] h-fit mt-0.5">{line.timestamp}</span>}
                      <span className="text-white/60">{line.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {notesOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 border-t border-white/8 pt-3 pb-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Notes</p>
              {notesLoading ? (
                <div className="space-y-1.5 animate-pulse">
                  {[100, 80, 90, 70].map((w, i) => <div key={i} className="h-2.5 bg-white/5 rounded" style={{ width: `${w}%` }} />)}
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[220px] prose prose-invert prose-xs scrollbar-thin">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent || ""}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-white/8 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.transcriptUrl && item.notesUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setAiPanelOpen(prev => !prev)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                aiPanelOpen ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "border-emerald-500/20 text-emerald-400/50 hover:text-emerald-300"
              }`}
            >
              <Sparkles size={11} />
              {aiPanelOpen ? "Close" : "Ask AI"}
            </motion.button>
          )}

          {item.transcriptUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleTranscriptClick}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                transcriptOpen ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              <FileText size={11} /> Transcript
            </motion.button>
          )}

          {item.notesUrl && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleNotesClick}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                notesOpen ? "bg-blue-500/20 border-blue-400/50 text-blue-300" : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              <BookOpen size={11} /> Notes
            </motion.button>
          )}

          {!item.transcriptUrl && onGenerateTranscript && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onGenerateTranscript(item)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              Generate Transcript
            </motion.button>
          )}
          {!item.notesUrl && item.transcriptUrl && onGenerateNotes && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onGenerateNotes(item)}
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
          disabled={isPending}
          className="p-1.5 rounded-md text-white/25 hover:text-red-400/70 transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </motion.div>
  );
};

export default MediaCard;
