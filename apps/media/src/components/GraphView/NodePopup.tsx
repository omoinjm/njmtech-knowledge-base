"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Play, X, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/PlatformIcon";
import Image from "next/image";
import { GraphNode } from "./useGraphData";

interface NodePopupProps {
  node: GraphNode;
  screenX: number;
  screenY: number;
  onClose: () => void;
  containerWidth: number;
  containerHeight: number;
}

export const NodePopup: React.FC<NodePopupProps> = ({
  node,
  screenX,
  screenY,
  onClose,
  containerWidth,
  containerHeight,
}) => {
  const [notesContent, setNotesContent] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const item = node.item;

  useEffect(() => {
    if (!item?.notesUrl) {
      setNotesContent(null);
      return;
    }

    setIsLoadingNotes(true);
    fetch(item.notesUrl)
      .then((r) => r.text())
      .then((text) => {
        setNotesContent(text.slice(0, 300));
        setIsLoadingNotes(false);
      })
      .catch(() => {
        setNotesContent(null);
        setIsLoadingNotes(false);
      });
  }, [item?.notesUrl]);

  if (!item) return null;

  const POPUP_WIDTH = 320;
  // Basic overflow check
  const finalX = screenX + POPUP_WIDTH > containerWidth ? screenX - POPUP_WIDTH - 40 : screenX;
  const finalY = screenY + 250 > containerHeight ? screenY - 260 : screenY;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{ duration: 0.15 }}
      style={{
        left: finalX,
        top: finalY,
      }}
      className="fixed z-50 w-[320px] rounded-xl border border-emerald-500/25 bg-[#050a0e]/95 p-0 shadow-[0_0_30px_rgba(0,255,136,0.1)] backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-emerald-500/5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-emerald-500/20 bg-black">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <PlatformIcon platform={item.platform} />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-tight text-white line-clamp-2">
              {item.title}
            </h3>
            <button
              onClick={onClose}
              className="shrink-0 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
            <span className="truncate">{item.authorName}</span>
            <span>•</span>
            <span className="capitalize">{item.platform}</span>
          </div>
          {item.category && (
            <div className="mt-2 w-fit rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
              {item.category}
            </div>
          )}
        </div>
      </div>

      {/* Content / Notes Preview */}
      <div className="px-4 py-3 border-t border-emerald-500/10">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-2">
          Notes Preview
        </h4>
        <div className="max-h-[120px] overflow-hidden text-ellipsis prose prose-invert prose-sm text-[12px] leading-relaxed text-white/80">
          {isLoadingNotes ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full bg-emerald-500/10 rounded" />
              <div className="h-3 w-4/5 bg-emerald-500/10 rounded" />
            </div>
          ) : notesContent ? (
            <ReactMarkdown>
              {notesContent + (notesContent.length >= 300 ? "..." : "")}
            </ReactMarkdown>
          ) : (
            <span className="text-[12px] text-white/40 italic">
              No notes available
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 p-3 bg-black/40 border-t border-emerald-500/10">
        <div className="flex gap-2">
          {item.transcriptUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 border-emerald-500/30 bg-transparent text-[11px] text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <a href={item.transcriptUrl} target="_blank" rel="noopener noreferrer">
                <FileText size={12} className="mr-1.5" />
                Transcript
              </a>
            </Button>
          )}
        </div>
        <Button
          size="sm"
          asChild
          className="h-8 bg-emerald-500/20 border border-emerald-500/40 text-[11px] text-emerald-300 hover:bg-emerald-500/30"
        >
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <Play size={12} className="mr-1.5 fill-current" />
            Watch Video
          </a>
        </Button>
      </div>
    </motion.div>
  );
};
