import { TranscriptLine } from "@/types/ai";

/**
 * Parses raw transcript text into structured lines with timestamps.
 * Supports multiple formats including [HH:MM:SS], WebVTT, and plain timestamp prefixes.
 *
 * @param raw - The raw string content of the transcript file
 * @returns An array of parsed transcript lines
 *
 * @example
 * const lines = parseTranscript("[00:01:23] Hello world");
 * console.log(lines[0].timestamp); // "00:01:23"
 */
export function parseTranscript(raw: string): TranscriptLine[] {
  const lines = raw.split("\n").filter((l) => l.trim());

  return lines
    .map((line) => {
      // Format 1: [HH:MM:SS] text or [MM:SS] text
      const bracketMatch = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)/);
      if (bracketMatch) {
        return { timestamp: bracketMatch[1], text: bracketMatch[2] };
      }

      // Format 2: WebVTT timestamp line (skip arrow lines)
      if (line.includes("-->")) return null;

      // Format 3: plain timestamp prefix HH:MM:SS text
      const plainMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/);
      if (plainMatch) {
        return { timestamp: plainMatch[1], text: plainMatch[2] };
      }

      // No timestamp — plain text line
      return { timestamp: null, text: line };
    })
    .filter((line): line is TranscriptLine => line !== null);
}
