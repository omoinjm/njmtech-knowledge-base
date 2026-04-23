"use client";

import React, { useCallback, useRef, useState, useMemo, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useGraphData } from "@/hooks/useGraphData";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MediaCard from "@/components/MediaCard";
import { GraphTooltip } from "./GraphTooltip";
import { NodePopup } from "./NodePopup";
import { AnimatePresence } from "framer-motion";
import { 
  COSMIC_COLORS, 
  drawMediaNode, 
  drawTagNode, 
  drawCategoryNode 
} from "@/lib/graph/nodePainter";
import { advanceParticles, seedParticles } from "@/lib/graph/particles";
import { configureForces } from "@/lib/graph/forces";
import { useTagVisibility } from "@/hooks/useTagVisibility";
import { ZOOM_THRESHOLDS, GraphNode, GraphLink, ParticleState } from "@/lib/graph/types";
import type { MediaItem } from "@/types/media";

/**
 * Prop interface for the GraphView component.
 */
export interface GraphViewProps {
  /** Array of media items to visualize */
  items: MediaItem[];
  /** Callback to trigger AI categorization */
  onCategorize?: (id: string, transcriptUrl: string) => Promise<void>;
  /** Callback to soft-delete an item */
  onDelete?: (id: string) => Promise<void>;
  /** Callback to generate transcript for public items */
  onGenerateTranscript?: (item: MediaItem) => Promise<void>;
  /** Callback to generate notes for public items */
  onGenerateNotes?: (item: MediaItem) => Promise<void>;
  /** Injected server action for AI question generation */
  onGenerateQuestions: (transcript: string, title: string) => Promise<string[]>;
  /** Injected server action for AI question answering */
  onAnswerQuestion: (question: string, transcript: string, title: string) => Promise<string>;
}

/**
 * A cosmic-themed, force-directed graph visualization for media items.
 * Uses progressive disclosure based on zoom levels and supports interactive exploration.
 */
export default function GraphView({
  items,
  onCategorize,
  onDelete,
  onGenerateTranscript,
  onGenerateNotes,
  onGenerateQuestions,
  onAnswerQuestion,
}: GraphViewProps) {
  const { nodes: allNodes, links: allLinks } = useGraphData(items);
  const fgRef = useRef<ForceGraphMethods>(null);
  const { theme } = useTheme();

  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [popupNode, setPopupNode] = useState<GraphNode | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<GraphLink>());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showTagsByZoom, setShowTagsByZoom] = useState(false);
  
  const [tagsEnabled, setTagsEnabled] = useTagVisibility(true);

  const zoomLevelRef = useRef(1);
  const hasInitiallyFit = useRef(false);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const stars = useRef<{ x: number; y: number; opacity: number }[]>([]);
  const particlesMap = useRef<Map<string, ParticleState[]>>(new Map());

  const { nodes, links } = useMemo(() => {
    const showTags = tagsEnabled && showTagsByZoom;
    return {
      nodes: allNodes.filter(n => n.type !== "tag" || showTags),
      links: allLinks.filter(l => l.type !== "media-tag" || showTags)
    };
  }, [allNodes, allLinks, showTagsByZoom, tagsEnabled]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    configureForces(fg, allNodes, allLinks);
    fg.d3ReheatSimulation();
  }, [allNodes, allLinks]);

  useEffect(() => {
    stars.current = Array.from({ length: 150 }, () => ({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  useEffect(() => {
    allLinks.forEach((link: any) => {
      const linkId = `${link.source.id || link.source}-${link.target.id || link.target}`;
      if (!particlesMap.current.has(linkId)) {
        particlesMap.current.set(linkId, seedParticles(4));
      }
    });
  }, [allLinks]);

  const nodePaint = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const opacity = isHighlighted ? 1 : 0.15;

    ctx.save();
    ctx.translate(node.x, node.y);

    if (node.type === "media") {
      // Handle image loading if not in cache
      if (node.item?.thumbnailUrl && !imgCache.current.has(node.item.thumbnailUrl)) {
        const img = new Image();
        img.src = node.item.thumbnailUrl;
        img.onload = () => {
          imgCache.current.set(node.item!.thumbnailUrl!, img);
          // Trigger a re-render of the graph once image is loaded
          if (fgRef.current) {
            fgRef.current.zoom(fgRef.current.zoom());
          }
        };
        imgCache.current.set(node.item.thumbnailUrl, img); // Set early to avoid double-loading
      }
      drawMediaNode(node, ctx, globalScale, opacity, imgCache.current);
    }
    else if (node.type === "tag") drawTagNode(node, ctx, globalScale, opacity, tagsEnabled);
    else if (node.type === "category") drawCategoryNode(node, ctx, globalScale, opacity);

    if (hoverNode?.id === node.id && globalScale > 0.5) {
      ctx.strokeStyle = COSMIC_COLORS.highlight;
      ctx.lineWidth = 2 / globalScale;
      ctx.beginPath();
      const r = node.type === "media" ? 24 : node.type === "category" ? 32 : 15;
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }, [highlightNodes, hoverNode, tagsEnabled]);

  const linkPaint = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { source, target } = link;
    if (!source.x || !target.x) return;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = COSMIC_COLORS.linkLine;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const linkId = `${(source.id || source)}-${(target.id || target)}`;
    const particles = particlesMap.current.get(linkId);
    if (particles) {
      const isBrainMode = globalScale < ZOOM_THRESHOLDS.brain;
      particles.forEach(p => {
        p.progress = (p.progress + 0.003) % 1;
        const x = source.x + (target.x - source.x) * p.progress;
        const y = source.y + (target.y - source.y) * p.progress;
        let opacity = Math.sin(p.progress * Math.PI) * 0.9;
        if (isBrainMode) opacity *= 1.5;
        
        ctx.beginPath();
        ctx.arc(x, y, isBrainMode ? 1.5 : 2, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`;
        ctx.fill();
      });
    }
  }, []);

  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas;
    const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
    grad.addColorStop(0, COSMIC_COLORS.bgCenter);
    grad.addColorStop(1, COSMIC_COLORS.bgEdge);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    stars.current.forEach(star => {
      ctx.beginPath();
      ctx.arc(star.x + width/2, star.y + height/2, 0.5, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    });
    ctx.restore();
  }, []);

  const handleNodeClick = (node: any) => {
    if (node.type === "media") {
      const screenCoords = fgRef.current?.graph2ScreenCoords(node.x, node.y);
      if (screenCoords) {
        setPopupPos({ x: screenCoords.x + 20, y: screenCoords.y - 20 });
        setPopupNode(node);
      }
    } else {
      const newHighlightNodes = new Set<string>();
      const newHighlightLinks = new Set<GraphLink>();
      if (!highlightNodes.has(node.id) || highlightNodes.size === 1) {
        newHighlightNodes.add(node.id);
        allLinks.forEach((link: any) => {
          const sId = link.source.id || link.source;
          const tId = link.target.id || link.target;
          if (sId === node.id || tId === node.id) {
            newHighlightLinks.add(link);
            newHighlightNodes.add(sId);
            newHighlightNodes.add(tId);
          }
        });
      }
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    }
  };

  return (
    <div className="relative h-[calc(100vh-250px)] w-full overflow-hidden rounded-xl border border-border bg-background" onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>
      {/* Interaction Guide */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
        <div className="rounded-lg border border-border bg-black/40 p-3 shadow-sm backdrop-blur-md pointer-events-auto">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Controls</h4>
          <ul className="space-y-1.5 text-xs text-white/80">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-8 items-center justify-center rounded bg-emerald-950/50 border border-emerald-500/30 font-mono text-[10px]">Drag</span>
              <span>Pan / Move</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-8 items-center justify-center rounded bg-emerald-950/50 border border-emerald-500/30 font-mono text-[10px]">Scroll</span>
              <span>Zoom</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-8 items-center justify-center rounded bg-emerald-950/50 border border-emerald-500/30 font-mono text-[10px]">Click</span>
              <span>Focus</span>
            </li>
          </ul>
        </div>
        
        <div className="rounded-lg border border-border bg-black/40 p-3 shadow-sm backdrop-blur-md pointer-events-auto">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Legend</h4>
          <div className="space-y-1.5 text-xs text-white/80">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#00ff88]" />
              <span>Media Item</span>
            </div>
            <div 
              className="flex items-center gap-2 cursor-pointer select-none group"
              onClick={() => setTagsEnabled(prev => !prev)}
              title={tagsEnabled ? "Hide topic tags" : "Show topic tags"}
            >
              <div className={`h-2.5 w-2.5 rounded-sm border-2 border-emerald-400 transition-opacity ${
                tagsEnabled ? "opacity-100" : "opacity-30"
              }`} />
              <span className={`transition-all ${
                tagsEnabled
                  ? "text-white/80"
                  : "text-white/30 line-through"
              }`}>
                Topic Tag
              </span>
              
              <div className={`ml-auto w-7 h-4 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
                tagsEnabled ? "bg-emerald-500/40" : "bg-white/10"
              }`}>
                <div className={`w-3 h-3 rounded-full bg-emerald-400 transition-transform duration-200 ${
                  tagsEnabled ? "translate-x-3" : "translate-x-0"
                }`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-emerald-400 relative">
                 <div className="absolute inset-x-[-2px] top-1/2 h-[1px] bg-emerald-400" />
              </div>
              <span>Category Hub</span>
            </div>
          </div>
        </div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        nodeCanvasObject={nodePaint}
        linkCanvasObject={linkPaint}
        onNodeHover={setHoverNode}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setPopupNode(null)}
        onEngineStop={() => {
          if (!hasInitiallyFit.current) {
            fgRef.current?.zoomToFit(400, 80);
            hasInitiallyFit.current = true;
          }
          nodes.forEach((node: any) => { node.fx = node.x; node.fy = node.y; });
        }}
        onRenderFramePre={onRenderFramePre}
        onZoom={({ k }) => {
          zoomLevelRef.current = k;
          const shouldShow = k >= ZOOM_THRESHOLDS.tag;
          if (shouldShow !== showTagsByZoom) setShowTagsByZoom(shouldShow);
        }}
        backgroundColor={COSMIC_COLORS.bgEdge}
        cooldownTicks={200}
        minZoom={0.1}
        maxZoom={8}
      />

      <AnimatePresence>
        {popupNode && (
          <NodePopup
            node={popupNode}
            screenX={popupPos.x}
            screenY={popupPos.y}
            onClose={() => setPopupNode(null)}
            containerWidth={window.innerWidth}
            containerHeight={window.innerHeight}
            onGenerateQuestions={onGenerateQuestions}
            onAnswerQuestion={onAnswerQuestion}
          />
        )}
      </AnimatePresence>

      {hoverNode && !popupNode && (
        <div className="pointer-events-none fixed z-50" style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}>
          <GraphTooltip node={hoverNode} />
        </div>
      )}

      <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4"><SheetTitle>Media Details</SheetTitle></SheetHeader>
          {selectedNode?.item && (
            <MediaCard
              item={selectedNode.item}
              index={0}
              onCategorize={onCategorize}
              onDelete={async (id) => { setSelectedNode(null); if (onDelete) await onDelete(id); }}
              onGenerateTranscript={onGenerateTranscript}
              onGenerateNotes={onGenerateNotes}
              onGenerateQuestions={onGenerateQuestions}
              onAnswerQuestion={onAnswerQuestion}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
