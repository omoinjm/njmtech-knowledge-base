"use client";

import { useState, useEffect } from "react";
import type { FetchState } from "@/types/ui";
import { getInlineMediaFileUrl } from "@/lib/media-file-url";

/**
 * Hook to fetch and manage the state of markdown notes.
 *
 * @param notesUrl - URL of the markdown file
 * @returns Current fetch state of the notes
 */
export function useNotes(notesUrl: string | null): FetchState<string> {
  const [state, setState] = useState<FetchState<string>>({ status: "idle" });

  useEffect(() => {
    if (!notesUrl) {
      setState({ status: "idle" });
      return;
    }

    const readableUrl = getInlineMediaFileUrl(notesUrl, "notes");
    if (!readableUrl) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    fetch(readableUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch notes");
        return r.text();
      })
      .then((text) => {
        setState({ status: "success", data: text });
      })
      .catch((err) => {
        setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
      });
  }, [notesUrl]);

  return state;
}
