"use client";

import { useState, useEffect } from "react";
import type { FetchState } from "@/types/ui";
import { getInlineMediaFileUrl } from "@/lib/media-file-url";

/**
 * Hook to fetch and manage the state of a raw transcript.
 *
 * @param url - URL of the transcript text file
 * @param enabled - Whether fetching is active
 * @returns Current fetch state of the transcript
 */
export function useTranscript(
  url: string | null,
  enabled: boolean
): FetchState<string> {
  const [state, setState] = useState<FetchState<string>>({ status: "idle" });

  useEffect(() => {
    if (!enabled || !url) {
      setState({ status: "idle" });
      return;
    }

    // Don't re-fetch if already loading or success
    if (state.status === "loading" || state.status === "success") return;

    const readableUrl = getInlineMediaFileUrl(url, "transcript");
    if (!readableUrl) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    fetch(readableUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch transcript");
        return r.text();
      })
      .then((text) => {
        setState({ status: "success", data: text });
      })
      .catch((err) => {
        setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
      });
  }, [url, enabled]);

  return state;
}
