"use client";

import { useMemo } from "react";
import type { MediaItem } from "@/types/media";
import type { GraphNode, GraphLink } from "@/lib/graph/types";

/**
 * Transforms a list of media items into a graph structure with categories and tags.
 *
 * @param items - Array of media items to visualize
 * @returns Object containing nodes and links for the graph
 */
export function useGraphData(items: MediaItem[]): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  return useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const categories = new Set<string>();
    const tags = new Set<string>();

    items.forEach((item) => {
      // Media node
      nodes.push({
        id: item.id,
        name: item.title,
        type: "media",
        item,
      });

      // Category node and link
      if (item.category) {
        categories.add(item.category);
        links.push({
          source: item.category,
          target: item.id,
          type: "category-media",
        });
      }

      // Tag nodes and links
      item.tags.forEach((tag) => {
        const tagId = `tag-${tag}`;
        tags.add(tag);
        links.push({
          source: item.id,
          target: tagId,
          type: "media-tag",
        });
      });
    });

    // Add category nodes
    categories.forEach((cat) => {
      nodes.push({
        id: cat,
        name: cat,
        type: "category",
      });
    });

    // Add tag nodes
    tags.forEach((tag) => {
      nodes.push({
        id: `tag-${tag}`,
        name: tag,
        type: "tag",
      });
    });

    return { nodes, links };
  }, [items]);
}
