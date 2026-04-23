import * as d3 from "d3-force";
import { GraphNode, GraphLink } from "./types";

/**
 * Configures the d3-force simulation with clustering and repulsion.
 *
 * @param fg - The force graph instance (any due to library types)
 * @param allNodes - The complete set of graph nodes
 * @param allLinks - The complete set of graph links
 */
export function configureForces(
  fg: any,
  allNodes: GraphNode[],
  allLinks: GraphLink[]
): void {
  // 1. Repulsion
  fg.d3Force("charge")?.strength(-600);

  // 2. Link distances
  fg.d3Force("link")
    ?.distance((link: any) => {
      if (link.type === "category-media") return 120;
      if (link.type === "media-tag") return 80;
      return 100;
    })
    .strength((link: any) => {
      if (link.type === "category-media") return 0.8;
      if (link.type === "media-tag") return 0.5;
      return 0.6;
    });

  // 3. Collision
  fg.d3Force(
    "collision",
    d3.forceCollide((node: any) => {
      if (node.type === "category") return 80;
      if (node.type === "media") return 40;
      return 25;
    })
  );

  // 4. Island Clustering
  const categoryNodes = allNodes.filter((n) => n.type === "category");
  const islandRadius = 400;
  categoryNodes.forEach((catNode: any, i) => {
    const angle = (2 * Math.PI * i) / categoryNodes.length;
    catNode.islandX = Math.cos(angle) * islandRadius;
    catNode.islandY = Math.sin(angle) * islandRadius;
  });

  const mediaToIsland = new Map();
  allLinks.forEach((link: any) => {
    if (link.type === "category-media") {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      const catNode = allNodes.find((n) => n.id === sourceId);
      const mediaNode = allNodes.find((n) => n.id === targetId);
      if (catNode && mediaNode) {
        mediaToIsland.set(mediaNode.id, {
          x: (catNode as any).islandX,
          y: (catNode as any).islandY,
        });
      }
    }
  });

    fg.d3Force(
    "island-x",
    d3.forceX((node: any) => {
      if (node.type === "category") return node.islandX;
      if (node.type === "media") return mediaToIsland.get(node.id)?.x ?? 0;
      const connectedMedia = allLinks.find(
        (l) => {
          const targetId = typeof l.target === "string" ? l.target : l.target.id;
          return l.type === "media-tag" && targetId === node.id;
        }
      );
      const mediaIsland = connectedMedia
        ? mediaToIsland.get(typeof connectedMedia.source === "string" ? connectedMedia.source : connectedMedia.source.id)
        : null;
      return mediaIsland?.x ?? 0;
    }).strength((node: any) => (node.type === "category" ? 0.8 : 0.3))
  );

  fg.d3Force(
    "island-y",
    d3.forceY((node: any) => {
      if (node.type === "category") return node.islandY;
      if (node.type === "media") return mediaToIsland.get(node.id)?.y ?? 0;
      const connectedMedia = allLinks.find(
        (l) => {
          const targetId = typeof l.target === "string" ? l.target : l.target.id;
          return l.type === "media-tag" && targetId === node.id;
        }
      );
      const mediaIsland = connectedMedia
        ? mediaToIsland.get(typeof connectedMedia.source === "string" ? connectedMedia.source : connectedMedia.source.id)
        : null;
      return mediaIsland?.y ?? 0;
    }).strength((node: any) => (node.type === "category" ? 0.8 : 0.3))
  );

  fg.d3Force("center", null);
}
