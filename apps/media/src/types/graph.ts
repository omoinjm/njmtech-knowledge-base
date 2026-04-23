import { GraphNode, GraphLink } from "./media";

/**
 * Representation of the complete graph dataset.
 */
export interface GraphData {
  /** Array of nodes to be rendered in the graph */
  nodes: GraphNode[];
  /** Array of links connecting the nodes */
  links: GraphLink[];
}

/**
 * Available zoom levels for the graph view.
 * Determines the amount of detail shown.
 */
export type ZoomMode = "brain" | "mid" | "detail";

/**
 * Thresholds for zoom level triggers.
 */
export const ZOOM_THRESHOLDS = {
  /** Minimum zoom to show brain mode (minimalist nodes) */
  brain: 0.4,
  /** Zoom level to transition to medium detail */
  mid: 0.7,
  /** Zoom level required to show topic tags */
  tag: 0.7,
  /** Zoom level required to show text labels */
  label: 0.6,
} as const;

/**
 * State for a single animated particle on a graph link.
 */
export interface ParticleState {
  /** Normalised progress along the link path (0.0 to 1.0) */
  progress: number;
}
