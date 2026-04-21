"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { ExternalLink, FileText, BookText, Sparkles, Loader2, Play, Trash2, X, StickyNote } from "lucide-react";
import { useState, useTransition } from "react";
import type { MediaItem } from "@/lib/mock-data";
import { PlatformIcon } from "./PlatformIcon";

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

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: playing ? 0 : -4, transition: { duration: 0.2 } }}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-300 hover:border-primary/30 hover:shadow-[var(--shadow-glow)]"
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video overflow-hidden bg-black">
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

      {/* Content */}
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

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink size={13} />
            Original
          </a>

          <div className="flex items-center gap-1.5">
            {/* Categorize button — only when transcript exists and not yet categorized */}
            {item.transcriptUrl && !item.category && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCategorize}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                {isPending ? "Analyzing…" : "Categorize"}
              </motion.button>
            )}

            {item.transcriptUrl && (
              <motion.a
                whileTap={{ scale: 0.95 }}
                href={item.transcriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <FileText size={13} />
                Transcript
              </motion.a>
            )}
            {!item.transcriptUrl && onGenerateTranscript && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerateTranscript}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Transcript
              </motion.button>
            )}
            {item.notesUrl && (
              <motion.a
                whileTap={{ scale: 0.95 }}
                href={item.notesUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`notes-${item.videoId}.md`}
                className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:brightness-110"
              >
                <BookText size={13} />
                Notes
              </motion.a>
            )}
            {!item.notesUrl && item.transcriptUrl && onGenerateNotes && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerateNotes}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <StickyNote size={13} />}
                Notes
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSoftDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Hide
            </motion.button>
          </div>
        </div>
        {actionError && <p className="text-xs text-destructive">{actionError}</p>}
      </div>
    </motion.div>
  );
};

export default MediaCard;
