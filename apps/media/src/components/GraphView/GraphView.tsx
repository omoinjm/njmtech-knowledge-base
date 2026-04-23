"use client";

import React, { useCallback, useRef, useState, useMemo, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import * as d3 from "d3-force";
import { useGraphData, GraphNode, GraphLink } from "./useGraphData";
import { MediaItem } from "@/lib/mock-data";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import MediaCard from "@/components/MediaCard";
import { GraphTooltip } from "./GraphTooltip";
import { NodePopup } from "./NodePopup";
import { AnimatePresence } from "framer-motion";

interface Particle {
  progress: number;
}

interface GraphViewProps {
  items: MediaItem[];
  onCategorize?: (id: string, transcriptUrl: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onGenerateTranscript?: (item: MediaItem) => Promise<void>;
  onGenerateNotes?: (item: MediaItem) => Promise<void>;
}

const TAG_ZOOM_THRESHOLD = 0.7;

// Cosmic Theme Colors (Static)
const COSMIC_COLORS = {
  bgCenter: "#050a0e",
  bgEdge: "#000000",
  neonEmerald: "#00ff88",
  darkGreen: "#003320",
  categoryLabel: "#a7f3d0",
  textWhite: "rgba(255,255,255,0.75)",
  linkLine: "rgba(0,255,136,0.15)",
  highlight: "#00ff88",
};

export default function GraphView({
  items,
  onCategorize,
  onDelete,
  onGenerateTranscript,
  onGenerateNotes,
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
  
  const [tagsEnabled, setTagsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('njmtech_show_tags');
    return stored === null ? true : stored === 'true';
  });

  // Persist on change:
  useEffect(() => {
    localStorage.setItem('njmtech_show_tags', String(tagsEnabled));
  }, [tagsEnabled]);

  const zoomLevelRef = useRef(1);
  const hasInitiallyFit = useRef(false);

  // Progressive Disclosure: Filter graph data based on zoom level and toggle
  const { nodes, links } = useMemo(() => {
    const showTags = tagsEnabled && showTagsByZoom; // both must be true
    return {
      nodes: allNodes.filter(n => n.type !== 'tag' || showTags),
      links: allLinks.filter(l => l.type !== 'media-tag' || showTags)
    };
  }, [allNodes, allLinks, showTagsByZoom, tagsEnabled]);

  // Force Configuration for Cluster Islands
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // 1. Strong repulsion between ALL nodes
    fg.d3Force('charge')?.strength(-600);

    // 2. Link distance — keep edges long so clusters don't merge
    fg.d3Force('link')?.distance((link: any) => {
      if (link.type === 'category-media') return 120;
      if (link.type === 'media-tag') return 80;
      return 100;
    }).strength((link: any) => {
      if (link.type === 'category-media') return 0.8;
      if (link.type === 'media-tag') return 0.5;
      return 0.6;
    });

    // 3. Collision radius — prevent node overlap
    fg.d3Force('collision', d3.forceCollide((node: any) => {
      if (node.type === 'category') return 80;
      if (node.type === 'media') return 40;
      return 25; // tags
    }));

    // 4. Cluster centering — push each category island to a fixed point in space
    const categoryNodes = allNodes.filter(n => n.type === 'category');
    const islandRadius = 400; 
    categoryNodes.forEach((catNode: any, i) => {
      const angle = (2 * Math.PI * i) / categoryNodes.length;
      catNode.islandX = Math.cos(angle) * islandRadius;
      catNode.islandY = Math.sin(angle) * islandRadius;
    });

    // Map: mediaId → island center (inherit from category)
    const mediaToIsland = new Map();
    allLinks.forEach((link: any) => {
      if (link.type === 'category-media') {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        const catNode = allNodes.find(n => n.id === sourceId);
        const mediaNode = allNodes.find(n => n.id === targetId);
        if (catNode && mediaNode) {
          mediaToIsland.set(mediaNode.id, { x: (catNode as any).islandX, y: (catNode as any).islandY });
        }
      }
    });

    // Custom x/y positioning forces to pull toward islands
    fg.d3Force('island-x', d3.forceX((node: any) => {
      if (node.type === 'category') return node.islandX;
      if (node.type === 'media') return mediaToIsland.get(node.id)?.x ?? 0;
      // Tags inherit from connected media
      const connectedMedia = allLinks.find(l => 
        l.type === 'media-tag' && ((l.target.id || l.target) === node.id)
      );
      const mediaIsland = connectedMedia 
        ? mediaToIsland.get(connectedMedia.source.id || connectedMedia.source)
        : null;
      return mediaIsland?.x ?? 0;
    }).strength((node: any) => node.type === 'category' ? 0.8 : 0.3));

    fg.d3Force('island-y', d3.forceY((node: any) => {
      if (node.type === 'category') return node.islandY;
      if (node.type === 'media') return mediaToIsland.get(node.id)?.y ?? 0;
      const connectedMedia = allLinks.find(l => 
        l.type === 'media-tag' && ((l.target.id || l.target) === node.id)
      );
      const mediaIsland = connectedMedia 
        ? mediaToIsland.get(connectedMedia.source.id || connectedMedia.source)
        : null;
      return mediaIsland?.y ?? 0;
    }).strength((node: any) => node.type === 'category' ? 0.8 : 0.3));

    // Remove the default centering force
    fg.d3Force('center', null);

    // Initial nudge to simulation
    fg.d3ReheatSimulation();
  }, [allNodes, allLinks, showTagsByZoom, tagsEnabled]);

  // Star Background
  const stars = useRef<{ x: number; y: number; opacity: number }[]>([]);
  useEffect(() => {
    stars.current = Array.from({ length: 150 }, () => ({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  // Particle System State
  const particlesMap = useRef<Map<string, Particle[]>>(new Map());
  useEffect(() => {
    allLinks.forEach((link: any) => {
      const linkId = `${link.source.id || link.source}-${link.target.id || link.target}`;
      if (!particlesMap.current.has(linkId)) {
        particlesMap.current.set(linkId, Array.from({ length: 4 }, (_, i) => ({
          progress: i * 0.25
        })));
      }
    });
  }, [allLinks]);

  const handleNodeHover = (node: any) => {
    setHoverNode(node || null);
  };

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

  const handleNodeDrag = (node: any) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleNodeDragEnd = (node: any) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopupNode(null);
      if (e.key.toLowerCase() === "t" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setTagsEnabled(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const drawMediaNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number, opacity: number) => {
    const { name, item } = node;
    const baseRadius = 22;

    // Zoom-aware sizing (Obsidian-style)
    let drawRadius = baseRadius;
    const isBrainMode = globalScale < 0.4;
    const isMidMode = globalScale >= 0.4 && globalScale < 0.7;

    if (isBrainMode) {
      drawRadius = 4;
    } else if (isMidMode) {
      drawRadius = baseRadius * 0.6;
    }

    // Outer Glows
    const glowLevels = isBrainMode ? [{ r: drawRadius + 4, a: 0.15 }] : [
      { r: drawRadius + 20, a: 0.03 * opacity },
      { r: drawRadius + 12, a: 0.08 * opacity },
      { r: drawRadius + 6, a: 0.15 * opacity }
    ];

    glowLevels.forEach(glow => {
      ctx.beginPath();
      ctx.arc(0, 0, glow.r, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(0, 255, 136, ${glow.a * opacity})`;
      ctx.fill();
    });

    // Base Orb Gradient
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, drawRadius);
    grad.addColorStop(0, `rgba(0, 255, 136, ${0.8 * opacity})`);
    grad.addColorStop(1, `rgba(0, 51, 32, ${opacity})`);
    
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();

    if (isBrainMode || isMidMode) return;

    // Image Clipping (Detail Mode only)
    if (item?.thumbnailUrl) {
      const img = imgCache.current.get(item.thumbnailUrl);
      if (img && img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius - 4, 0, 2 * Math.PI);
        ctx.clip();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, -(drawRadius - 4), -(drawRadius - 4), (drawRadius - 4) * 2, (drawRadius - 4) * 2);
        
        // Emerald Tint
        ctx.fillStyle = `rgba(0, 255, 136, ${0.15 * opacity})`;
        ctx.fill();
        ctx.restore();
      } else if (item.thumbnailUrl && !imgCache.current.has(item.thumbnailUrl)) {
        const newImg = new Image();
        newImg.src = item.thumbnailUrl;
        newImg.onload = () => {
          imgCache.current.set(item.thumbnailUrl!, newImg);
          if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom());
        };
        imgCache.current.set(item.thumbnailUrl, newImg);
      }
    }

    // Specular Highlight
    ctx.save();
    ctx.filter = "blur(2px)";
    ctx.beginPath();
    ctx.ellipse(-drawRadius/3, -drawRadius/3, drawRadius/3, drawRadius/5, Math.PI/4, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * opacity})`;
    ctx.fill();
    ctx.restore();

    // Label visibility threshold
    if (globalScale > 0.6) {
      const label = name.length > 20 ? name.substring(0, 20) + "..." : name;
      ctx.font = `${10 / globalScale}px 'Inter', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = COSMIC_COLORS.textWhite;
      ctx.globalAlpha = opacity;
      ctx.fillText(label, 0, drawRadius + 14);
    }
  }, []);

  const drawTagNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number, opacity: number, tagsEnabled: boolean) => {
    const { name } = node;
    const baseRadius = 14;
    let drawRadius = baseRadius;
    
    const isBrainMode = globalScale < 0.4;

    if (isBrainMode) {
      drawRadius = 3;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
      ctx.fillStyle = COSMIC_COLORS.neonEmerald;
      ctx.globalAlpha = 0.8 * opacity * (tagsEnabled ? 1 : 0);
      if (ctx.globalAlpha <= 0) return;
      ctx.fill();
      return;
    }

    const fontSize = 11;
    ctx.font = `${fontSize}px 'Inter', sans-serif`;
    const textWidth = ctx.measureText(name).width;
    const width = textWidth + 20;
    const height = 22;

    // Progressive Fade-in for tags
    const fadeProgress = tagsEnabled 
      ? Math.min(1, (globalScale - TAG_ZOOM_THRESHOLD) / 0.2)
      : 0;

    if (fadeProgress <= 0) return;

    ctx.save();
    ctx.globalAlpha = fadeProgress * opacity;
    ctx.shadowColor = COSMIC_COLORS.neonEmerald;
    ctx.shadowBlur = 12 * opacity;
    
    ctx.beginPath();
    ctx.roundRect(-width/2, -height/2, width, height, height/2);
    ctx.fillStyle = `rgba(0, 255, 136, ${0.08 * opacity})`;
    ctx.strokeStyle = COSMIC_COLORS.neonEmerald;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (globalScale > 0.9) {
      ctx.save();
      ctx.globalAlpha = fadeProgress * opacity;
      ctx.fillStyle = COSMIC_COLORS.neonEmerald;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
  }, []);

  const drawCategoryNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number, opacity: number) => {
    const { name } = node;
    const baseRadius = 28;
    let drawRadius = baseRadius;

    const isBrainMode = globalScale < 0.4;
    const isMidMode = globalScale >= 0.4 && globalScale < 0.7;

    if (isBrainMode) {
      drawRadius = 5;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
      ctx.fillStyle = COSMIC_COLORS.neonEmerald;
      ctx.shadowColor = COSMIC_COLORS.neonEmerald;
      ctx.shadowBlur = 10;
      ctx.fill();
      return;
    }

    if (isMidMode) drawRadius = baseRadius * 0.6;

    // Outer Ring
    ctx.save();
    ctx.shadowColor = COSMIC_COLORS.neonEmerald;
    ctx.shadowBlur = 20 * opacity;
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = COSMIC_COLORS.neonEmerald;
    ctx.lineWidth = 3;
    ctx.globalAlpha = opacity;
    ctx.stroke();
    ctx.restore();

    // Inner Circle
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius - 10, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0, 255, 136, ${0.2 * opacity})`;
    ctx.fill();

    // Saturn Ring
    ctx.save();
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.3 * opacity})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Label
    if (globalScale > 0.6) {
      ctx.font = `bold ${12 / globalScale}px 'Inter', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = COSMIC_COLORS.categoryLabel;
      ctx.globalAlpha = opacity;
      ctx.fillText(name, 0, drawRadius + 20);
    }
  }, []);

  const nodePaint = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const opacity = isHighlighted ? 1 : 0.15;

    ctx.save();
    ctx.translate(node.x, node.y);

    if (node.type === "media") drawMediaNode(node, ctx, globalScale, opacity);
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
  }, [drawMediaNode, drawTagNode, drawCategoryNode, highlightNodes, hoverNode, tagsEnabled]);

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

  const onRenderFramePost = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    nodes.forEach((node: any) => {
      const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
      if (!isHighlighted) return;

      ctx.save();
      ctx.translate(node.x, node.y);
      const radius = node.type === "media" ? 22 : node.type === "category" ? 28 : 10;
      
      ctx.beginPath();
      ctx.arc(0, 0, radius + 6, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(0, 255, 136, 0.07)`;
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }, [nodes, highlightNodes]);

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
      const isBrainMode = globalScale < 0.4;
      particles.forEach(p => {
        p.progress = (p.progress + 0.003) % 1;
        
        const x = source.x + (target.x - source.x) * p.progress;
        const y = source.y + (target.y - source.y) * p.progress;
        
        let opacity = Math.sin(p.progress * Math.PI) * 0.9;
        if (isBrainMode) opacity *= 1.5; // Brain mode boost
        
        for (let i = 0; i < 4; i++) {
          const tailProgress = (p.progress - (i + 1) * 0.015 + 1) % 1;
          const tx = source.x + (target.x - source.x) * tailProgress;
          const ty = source.y + (target.y - source.y) * tailProgress;
          ctx.beginPath();
          ctx.arc(tx, ty, 1.5 - i * 0.3, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(0, 255, 136, ${opacity * (0.5 - i * 0.1)})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, isBrainMode ? 1.5 : 2, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`;
        ctx.fill();
      });
    }
  }, []);

  const handleEngineStop = useCallback(() => {
    if (!hasInitiallyFit.current) {
      fgRef.current?.zoomToFit(400, 80);
      hasInitiallyFit.current = true;
    }
    
    // Pin all nodes once simulation naturally stops
    nodes.forEach((node: any) => {
      node.fx = node.x;
      node.fy = node.y;
    });
  }, [nodes]);

  return (
    <div 
      className="relative h-[calc(100vh-250px)] w-full overflow-hidden rounded-xl border border-border bg-background"
      onMouseMove={handleMouseMove}
    >
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
              title={tagsEnabled ? 'Hide topic tags' : 'Show topic tags'}
            >
              <div className={`h-2.5 w-2.5 rounded-sm border-2 border-emerald-400 transition-opacity ${
                tagsEnabled ? 'opacity-100' : 'opacity-30'
              }`} />
              <span className={`transition-all ${
                tagsEnabled
                  ? 'text-white/80'
                  : 'text-white/30 line-through'
              }`}>
                Topic Tag
              </span>
              
              {/* Toggle pill */}
              <div className={`ml-auto w-7 h-4 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
                tagsEnabled ? 'bg-emerald-500/40' : 'bg-white/10'
              }`}>
                <div className={`w-3 h-3 rounded-full bg-emerald-400 transition-transform duration-200 ${
                  tagsEnabled ? 'translate-x-3' : 'translate-x-0'
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
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={() => setPopupNode(null)}
        onEngineStop={handleEngineStop}
        onRenderFramePre={onRenderFramePre}
        onRenderFramePost={onRenderFramePost}
        onZoom={({ k }) => {
          zoomLevelRef.current = k;
          const shouldShow = k >= TAG_ZOOM_THRESHOLD;
          if (shouldShow !== showTagsByZoom) {
            setShowTagsByZoom(shouldShow);
          }
        }}
        backgroundColor={COSMIC_COLORS.bgEdge}
        cooldownTicks={200}
        cooldownTime={3000}
        minZoom={0.1}
        maxZoom={8}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
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
          />
        )}
      </AnimatePresence>

      {/* Tooltip Overlay */}
      {hoverNode && !popupNode && (
        <div 
          className="pointer-events-none fixed z-50"
          style={{ 
            left: mousePos.x + 15, 
            top: mousePos.y + 15 
          }}
        >
          <GraphTooltip node={hoverNode} />
        </div>
      )}

      {/* Media Detail Sheet */}
      <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Media Details</SheetTitle>
          </SheetHeader>
          {selectedNode?.item && (
            <div className="mt-4">
              <MediaCard
                item={selectedNode.item}
                index={0}
                onCategorize={onCategorize}
                onDelete={async (id) => {
                  setSelectedNode(null);
                  if (onDelete) await onDelete(id);
                }}
                onGenerateTranscript={onGenerateTranscript}
                onGenerateNotes={onGenerateNotes}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Clear Selection Button */}
      {(highlightNodes.size > 0) && (
        <button
          onClick={() => {
            setHighlightNodes(new Set());
            setHighlightLinks(new Set());
          }}
          className="absolute bottom-4 right-4 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-[0_0_15px_rgba(0,255,136,0.4)] transition-transform hover:scale-105 active:scale-95 z-10"
        >
          Clear Selection
        </button>
      )}
    </div>
  );
}
