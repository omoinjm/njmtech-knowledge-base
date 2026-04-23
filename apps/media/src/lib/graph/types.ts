import { MediaItem, NodeType } from "@/types/media";

/**
 * Data structure for a node in the force-directed graph.
 */
export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  item?: MediaItem;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  islandX?: number;
  islandY?: number;
}

/**
 * Data structure for a link between nodes in the graph.
 */
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "category-media" | "media-tag";
}

/**
 * State for a single animated particle on a graph link.
 */
export interface ParticleState {
  progress: number;
}

/**
 * Thresholds for zoom level triggers.
 */
export const ZOOM_THRESHOLDS = {
  brain: 0.4,
  mid: 0.7,
  tag: 0.7,
  label: 0.6,
} as const;
