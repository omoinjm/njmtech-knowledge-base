/**
 * Supported media platforms.
 */
export type Platform = "youtube" | "tiktok" | "instagram" | "twitter" | "vimeo" | "unknown";

export type KnowledgeBaseMode = "personal" | "public";

export interface KnowledgeBase {
  /** Unique identifier for the knowledge base */
  id: string;
  /** Human-readable knowledge base name */
  name: string;
  /** URL-safe slug used for stable references */
  slug: string;
  /** ISO date string of when the knowledge base was created */
  createdAt: string;
}

/**
 * Represents a single media item in the system.
 */
export interface MediaItem {
  /** Unique identifier for the media item */
  id: string;
  /** Original URL of the media content */
  url: string;
  /** Platform where the media is hosted */
  platform: Platform;
  /** Platform-specific video ID */
  videoId: string;
  /** Title of the media item */
  title: string;
  /** URL to the media's thumbnail image, if available */
  thumbnailUrl: string | null;
  /** Name of the content creator, if available */
  authorName: string | null;
  /** URL to the hosted transcript file (.txt) */
  transcriptUrl: string | null;
  /** URL to the hosted notes file (.md) */
  notesUrl: string | null;
  /** Primary category assigned to this media */
  category: string | null;
  /** List of topic tags associated with this media */
  tags: string[];
  /** ISO date string of when the item was added */
  createdAt: string;
  /** Knowledge base this item belongs to */
  knowledgeBaseId: string;
}

/**
 * Types of nodes available in the graph visualization.
 */
export type NodeType = "media" | "tag" | "category";

/**
 * Data structure for a node in the force-directed graph.
 */
export interface GraphNode {
  /** Unique identifier for the node */
  id: string;
  /** Display name for the node */
  name: string;
  /** Type of the node, determining its appearance and behaviour */
  type: NodeType;
  /** Associated media item (only for type="media") */
  item?: MediaItem;
  /** Force-directed graph coordinate X */
  x?: number;
  /** Force-directed graph coordinate Y */
  y?: number;
  /** Fixed coordinate X (pins the node) */
  fx?: number | null;
  /** Fixed coordinate Y (pins the node) */
  fy?: number | null;
  /** Cluster island assignment X (for category centering) */
  islandX?: number;
  /** Cluster island assignment Y (for category centering) */
  islandY?: number;
}

/**
 * Data structure for a link between nodes in the graph.
 */
export interface GraphLink {
  /** Source node ID or node object */
  source: string | GraphNode;
  /** Target node ID or node object */
  target: string | GraphNode;
  /** Type of relationship between the nodes */
  type: "category-media" | "media-tag";
}
