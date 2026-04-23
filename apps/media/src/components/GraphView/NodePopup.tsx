"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Play, X, ChevronUp, Sparkles, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/PlatformIcon";
import Image from "next/image";
import { GraphNode } from "./useGraphData";
import { AIPanel } from "@/components/shared/AIPanel";

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
  const [panelOpen, setPanelOpen] = useState(false);
  const item = node.item;

  if (!item) return null;

  const handleTranscriptToggle = () => {
    setPanelOpen(prev => !prev);
  };

  const POPUP_WIDTH = 320;
  // Basic overflow check
  const finalX = screenX + POPUP_WIDTH > containerWidth ? screenX - POPUP_WIDTH - 40 : screenX;
  const finalY = screenY + 400 > containerHeight ? Math.max(10, containerHeight - 530) : screenY;

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
      className="fixed z-50 w-[320px] max-h-[520px] flex flex-col rounded-xl border border-emerald-500/25 bg-[#050a0e]/95 p-0 shadow-[0_0_30px_rgba(0,255,136,0.1)] backdrop-blur-xl overflow-hidden"
    >
      {/* Header - fixed height */}
      <div className="shrink-0 flex items-start gap-3 p-4 bg-emerald-500/5">
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <AnimatePresence>
          {panelOpen ? (
            <motion.div
              key="ai-panel-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AIPanel
                transcriptUrl={item.transcriptUrl}
                notesUrl={item.notesUrl}
                videoUrl={item.url}
                title={item.title}
                enabled={panelOpen}
                variant="popup"
              />
            </motion.div>
          ) : (
            <motion.div
              key="notes-preview-only"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 border-t border-emerald-500/10"
            >
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-2">
                Notes Preview
              </h4>
              <div className="text-ellipsis prose prose-invert prose-sm text-[12px] leading-relaxed text-white/80">
                <NotesPreview notesUrl={item.notesUrl} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions - fixed */}
      <div className="shrink-0 flex items-center justify-between gap-2 p-3 bg-black/40 border-t border-emerald-500/10">
        <div className="flex gap-2">
          {item.transcriptUrl && item.notesUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranscriptToggle}
              className={`h-8 border-emerald-500/30 text-[11px] transition-colors ${
                panelOpen
                  ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/50'
                  : 'text-emerald-400/70 bg-transparent hover:bg-emerald-500/10 hover:text-emerald-300'
              }`}
            >
              {panelOpen ? <ChevronUp size={12} className="mr-1.5" /> : <Sparkles size={12} className="mr-1.5" />}
              {panelOpen ? 'Hide' : 'Ask AI'}
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

// Helper component for simple notes preview when AI panel is closed
const NotesPreview: React.FC<{ notesUrl: string | null }> = ({ notesUrl }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!notesUrl) return;
    setLoading(true);
    fetch(notesUrl)
      .then(r => r.text())
      .then(text => {
        setContent(text.slice(0, 300));
        setLoading(false);
      })
      .catch(() => {
        setContent(null);
        setLoading(false);
      });
  }, [notesUrl]);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-3 w-full bg-emerald-500/10 rounded" />
        <div className="h-3 w-4/5 bg-emerald-500/10 rounded" />
      </div>
    );
  }

  return content ? (
    <ReactMarkdown>{content + (content.length >= 300 ? "..." : "")}</ReactMarkdown>
  ) : (
    <span className="text-[12px] text-white/40 italic">No notes available</span>
  );
};

