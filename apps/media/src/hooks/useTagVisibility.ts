"use client";

import { useState, useEffect } from "react";

const TAG_VISIBILITY_KEY = "njmtech_show_tags";

/**
 * Hook to manage graph tag visibility with localStorage persistence.
 *
 * @param initial - Default visibility if none is stored
 * @returns Current visibility state and a setter function
 */
export function useTagVisibility(initial = true) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    const stored = localStorage.getItem(TAG_VISIBILITY_KEY);
    return stored === null ? initial : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(TAG_VISIBILITY_KEY, String(enabled));
  }, [enabled]);

  return [enabled, setEnabled] as const;
}
