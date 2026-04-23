"use client";

import { useState, useEffect } from "react";

type ViewMode = "grid" | "graph";
const VIEW_MODE_KEY = "njmtech_view_mode";

/**
 * Hook to manage the dashboard view mode (grid vs graph) with localStorage persistence.
 *
 * @param initial - Default view mode if none is stored
 * @returns Current view mode and a setter function
 */
export function useViewMode(initial: ViewMode = "grid") {
  const [viewMode, setViewMode] = useState<ViewMode>(initial);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
    if (saved === "grid" || saved === "graph") {
      setViewMode(saved);
    }
  }, []);

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  return [viewMode, toggleViewMode] as const;
}
