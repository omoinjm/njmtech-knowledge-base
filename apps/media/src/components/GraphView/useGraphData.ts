import { useMemo } from "react";
import type { MediaItem } from "@/lib/mock-data";

export interface GraphNode {
  id: string;
  name: string;
  type: "media" | "tag" | "category";
  item?: MediaItem;
  color?: string;
  val?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: "category-media" | "media-tag";
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function useGraphData(items: MediaItem[]): GraphData {
  return useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const tagsSet = new Set<string>();
    const categoriesSet = new Set<string>();

    // First pass: gather unique tags and categories
    items.forEach((item) => {
      if (item.category) categoriesSet.add(item.category);
      item.tags.forEach((tag) => {
        if (tag.trim()) tagsSet.add(tag.trim());
      });
    });

    // Add Category nodes
    categoriesSet.forEach((category) => {
      nodes.push({
        id: `category-${category}`,
        name: category,
        type: "category",
        val: 30,
      });
    });

    // Add Tag nodes (deduplicated via Set)
    tagsSet.forEach((tag) => {
      nodes.push({
        id: `tag-${tag}`,
        name: tag,
        type: "tag",
        val: 15,
      });
    });

    // Add Media nodes and links
    items.forEach((item) => {
      nodes.push({
        id: item.id,
        name: item.title,
        type: "media",
        item,
        val: 25,
      });

      // Link to category (Media orbits Category)
      if (item.category) {
        links.push({
          source: `category-${item.category}`,
          target: item.id,
          type: "category-media",
        });
      }

      // Link to tags (Tags orbit Media)
      item.tags.forEach((tag) => {
        if (tag.trim()) {
          links.push({
            source: item.id,
            target: `tag-${tag.trim()}`,
            type: "media-tag",
          });
        }
      });
    });

    return { nodes, links };
  }, [items]);
}
