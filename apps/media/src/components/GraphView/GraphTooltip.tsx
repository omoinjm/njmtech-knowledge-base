import React from "react";
import type { GraphNode } from "@/lib/graph/types";

interface GraphTooltipProps {
  node: GraphNode;
}

export const GraphTooltip: React.FC<GraphTooltipProps> = ({ node }) => {
  if (node.type === "media" && node.item) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md backdrop-blur-sm">
        <p className="max-w-xs text-sm font-semibold leading-tight">{node.item.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{node.item.authorName}</span>
          <span>•</span>
          <span className="capitalize">{node.item.platform}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md backdrop-blur-sm">
      <span className="capitalize">{node.type}: </span>
      <span>{node.name}</span>
    </div>
  );
};
