"use server";

import { put } from "@vercel/blob";
import { unstable_cache, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { getSubtitles } from "youtube-caption-extractor";
import {
  dbGetMediaItems,
  dbGetByUrl,
  dbGetById,
  dbUpsertMediaItem,
  dbUpdateCategory,
  dbSoftDeleteMediaItem,
  dbHasPersonalAccessKey,
  dbCreatePersonalAccessKey,
  dbVerifyPersonalAccessKey,
} from "@/lib/db";
import { fetchVideoMeta } from "@/lib/metadata";
import { categorizeTranscript } from "@/lib/categorize";
import type { MediaItem } from "@/lib/mock-data";
import { PERSONAL_ACCESS_COOKIE } from "@/lib/personal-access-cookie";
import type { GuestConfig } from "@/lib/guest-config";

interface ResolveMediaOptions {
  // No longer needed - removed blobToken and blobPrefixBase
}

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
}

const NOTES_SYSTEM_PROMPT = `You are a structured notes assistant. Given a video transcript, produce well-formatted Markdown notes.

Include:
- ## Summary (2-3 sentences)
- ## Key Points (bullet list)
- ## Timestamps (notable moments from the transcript with timestamps)
- ## Action Items (if any practical takeaways)

Use proper Markdown formatting. Be concise but comprehensive.`;

export const getMediaItems = unstable_cache(
  async (): Promise<MediaItem[]> => dbGetMediaItems(),
  ["media-items"],
  { tags: ["media"], revalidate: 60 },
);

function getRemoteFilename(url: string, fallbackBase: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    return segment || fallbackBase;
  } catch {
    return fallbackBase;
  }
}

async function transcribeYouTubeCaptions(videoId: string): Promise<string> {
  try {
    // The library automatically handles both manual and auto-generated captions
    // Try without lang parameter first to get best available (manual or auto-generated)
    let subtitles = await getSubtitles({ videoID: videoId });
    
    // Fallback: explicitly try English if nothing found
    if (!subtitles || subtitles.length === 0) {
      console.log("[transcribeYouTubeCaptions] No captions found, trying English explicitly...");
      subtitles = await getSubtitles({ videoID: videoId, lang: "en" });
    }
    
    if (!subtitles || subtitles.length === 0) {
      throw new Error("No captions found for this YouTube video (manual or auto-generated)");
    }

    // Format subtitles with timestamps
    const lines = subtitles.map((sub) => {
      const startTime = Math.floor(parseFloat(sub.start));
      const mins = Math.floor(startTime / 60);
      const secs = startTime % 60;
      const timestamp = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      return `[${timestamp}] ${sub.text}`;
    });

    return lines.join("\n");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[transcribeYouTubeCaptions] Failed:", errMsg);
    throw new Error(
      `Failed to get YouTube captions: ${errMsg}`,
    );
  }
}

async function transcribeWithOpenAI(
  originalUrl: string,
  videoId: string,
  apiKey: string,
): Promise<string> {
  const mediaRes = await fetch(originalUrl);
  if (!mediaRes.ok) {
    throw new Error(
      `Failed to fetch media for transcription: ${mediaRes.status}`,
    );
  }

  const contentType = mediaRes.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/") && !contentType.startsWith("video/")) {
    throw new Error(
      "OpenAI transcription currently requires a direct audio or video file URL. Use YouTube captions for YouTube pages.",
    );
  }

  const arrayBuffer = await mediaRes.arrayBuffer();
  const filename = getRemoteFilename(originalUrl, `${videoId}.media`);
  const file = new File([Buffer.from(arrayBuffer)], filename, {
    type: contentType || "application/octet-stream",
  });
  const client = new OpenAI({ apiKey });
  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  if (!transcription.text?.trim()) {
    throw new Error("OpenAI returned an empty transcript");
  }

  return transcription.text.trim();
}

async function transcribeWithGemini(
  originalUrl: string,
  apiKey: string,
): Promise<string> {
  const mediaRes = await fetch(originalUrl);
  if (!mediaRes.ok) {
    throw new Error(
      `Failed to fetch media for transcription: ${mediaRes.status}`,
    );
  }

  const contentType = mediaRes.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/") && !contentType.startsWith("video/")) {
    throw new Error(
      "Gemini transcription currently requires a direct audio or video file URL. Use YouTube captions for YouTube pages.",
    );
  }

  const arrayBuffer = await mediaRes.arrayBuffer();
  const base64Content = Buffer.from(arrayBuffer).toString("base64");

  // Determine MIME type for Gemini
  let mimeType = contentType;
  if (mimeType === "video/mp4") mimeType = "video/mp4";
  else if (mimeType.startsWith("audio/")) mimeType = contentType;
  else mimeType = "application/octet-stream";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Please transcribe this audio/video content into plain text. Provide only the transcription, no additional commentary.",
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Content,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini returned empty transcript");
  return text;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: NOTES_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  let data: AnthropicMessageResponse;
  try {
    data = (await res.json()) as AnthropicMessageResponse;
  } catch (err) {
    throw new Error(
      `Failed to parse Anthropic response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const block = data.content.find((entry) => entry.type === "text");
  if (!block?.text) throw new Error("Anthropic returned no text content");
  return block.text;
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: {
            text: NOTES_SYSTEM_PROMPT,
          },
        },
        generationConfig: {
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini notes response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini returned empty notes");
  return text;
}

async function generateNotesMarkdown(
  transcriptText: string,
  config: Pick<GuestConfig, "llmProvider" | "llmApiKey" | "llmModel">,
): Promise<string> {
  const userPrompt = `Here is the video transcript:\n\n${transcriptText.slice(
    0,
    12000,
  )}\n\nPlease generate structured notes.`;

  if (config.llmProvider === "openai") {
    const client = new OpenAI({ apiKey: config.llmApiKey });
    const completion = await client.chat.completions.create({
      model: config.llmModel || "gpt-4o-mini",
      messages: [
        { role: "system", content: NOTES_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI returned empty notes");
    return content;
  }

  if (config.llmProvider === "groq") {
    const client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const completion = await client.chat.completions.create({
      model: config.llmModel || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: NOTES_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Groq returned empty notes");
    return content;
  }

  if (config.llmProvider === "anthropic") {
    const content = await callAnthropic(
      config.llmApiKey,
      config.llmModel || "claude-3-haiku-20240307",
      userPrompt,
    );
    if (!content.trim()) throw new Error("Anthropic returned empty notes");
    return content.trim();
  }

  if (config.llmProvider === "gemini") {
    const content = await callGemini(
      config.llmApiKey,
      config.llmModel || "gemini-1.5-flash",
      userPrompt,
    );
    if (!content.trim()) throw new Error("Gemini returned empty notes");
    return content.trim();
  }

  throw new Error(`Unsupported notes provider: ${config.llmProvider}`);
}

async function resolveMediaItem(
  url: string,
): Promise<Omit<MediaItem, "id" | "createdAt">> {
  const meta = await fetchVideoMeta(url);

  return {
    url,
    platform: meta.platform,
    videoId: meta.videoId,
    title: meta.title,
    thumbnailUrl: meta.thumbnailUrl,
    authorName: meta.authorName,
    transcriptUrl: null,
    notesUrl: null,
    category: null,
    tags: [],
  };
}

export async function addMediaItem(
  url: string,
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { success: false, error: "URL is required" };

    // Return cached DB result immediately if it already has a resolved platform.
    // Unknown rows should be refreshed so improved URL detection can self-heal them.
    const existing = await dbGetByUrl(trimmedUrl);
    if (existing && existing.platform !== "unknown") {
      return { success: true, item: existing };
    }

    const resolvedItem = await resolveMediaItem(trimmedUrl);

    const item = await dbUpsertMediaItem({
      url: trimmedUrl,
      platform: resolvedItem.platform,
      videoId: resolvedItem.videoId,
      title: resolvedItem.title,
      thumbnailUrl: resolvedItem.thumbnailUrl,
      authorName: resolvedItem.authorName,
      transcriptUrl: resolvedItem.transcriptUrl,
      notesUrl: resolvedItem.notesUrl,
    });

    // Run categorization in background if transcript exists
    if (resolvedItem.transcriptUrl) {
      categorizeTranscript(resolvedItem.transcriptUrl).then(async (result) => {
        if (result) {
          // Only overwrite the title if the current one is generic or missing
          const needsTitleFix = 
            item.title === "Untitled" || 
            item.title === "Instagram" || 
            item.title.includes("Instagram Post");
            
          await dbUpdateCategory(
            item.id, 
            result.category, 
            result.tags, 
            needsTitleFix ? result.title : undefined
          );
          revalidateTag("media");
        }
      });
    }

    revalidateTag("media");
    return { success: true, item };
  } catch (err) {
    console.error("[addMediaItem]", err);
    return { success: false, error: "Failed to add media item" };
  }
}

export async function preparePublicMediaItem(
  url: string,
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { success: false, error: "URL is required" };

    const resolvedItem = await resolveMediaItem(trimmedUrl);
    return {
      success: true,
      item: {
        ...resolvedItem,
        id: `public-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    };
  } catch (err) {
    console.error("[preparePublicMediaItem]", err);
    return { success: false, error: "Failed to prepare media item" };
  }
}

export async function generatePublicTranscript(input: {
  item: Pick<MediaItem, "id" | "url" | "platform" | "videoId" | "title">;
  config: Pick<GuestConfig, "transcribeProvider" | "transcribeApiKey">;
}): Promise<{ success: boolean; transcriptContent?: string; error?: string }> {
  try {
    const { item, config } = input;

    let transcriptText: string;
    // For YouTube videos, always use YouTube captions regardless of selected provider
    if (item.platform === "youtube") {
      transcriptText = await transcribeYouTubeCaptions(item.videoId);
    } else if (config.transcribeProvider === "youtube-captions") {
      return {
        success: false,
        error: "YouTube captions are only available for YouTube videos",
      };
    } else if (config.transcribeProvider === "openai") {
      if (!config.transcribeApiKey.trim()) {
        return {
          success: false,
          error: "OpenAI transcription requires an API key",
        };
      }
      transcriptText = await transcribeWithOpenAI(
        item.url,
        item.videoId,
        config.transcribeApiKey,
      );
    } else if (config.transcribeProvider === "gemini") {
      if (!config.transcribeApiKey.trim()) {
        return {
          success: false,
          error: "Gemini transcription requires an API key",
        };
      }
      transcriptText = await transcribeWithGemini(
        item.url,
        config.transcribeApiKey,
      );
    } else {
      return {
        success: false,
        error: `Unsupported transcript provider: ${config.transcribeProvider}`,
      };
    }

    return { success: true, transcriptContent: transcriptText };
  } catch (err) {
    console.error("[generatePublicTranscript]", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to generate transcript",
    };
  }
}

export async function generatePublicNotes(input: {
  item: Pick<
    MediaItem,
    "id" | "platform" | "videoId" | "transcriptUrl" | "title"
  >;
  config: Pick<GuestConfig, "llmProvider" | "llmApiKey" | "llmModel">;
  transcriptContent: string;
}): Promise<{ success: boolean; notesContent?: string; error?: string }> {
  try {
    const { item, config, transcriptContent } = input;

    if (!config.llmApiKey.trim()) {
      return { success: false, error: "Notes provider API key is required" };
    }

    const notesMarkdown = await generateNotesMarkdown(
      transcriptContent,
      config,
    );
    return { success: true, notesContent: notesMarkdown };
  } catch (err) {
    console.error("[generatePublicNotes]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate notes",
    };
  }
}

export async function categorizeItem(
  id: string,
  transcriptUrl: string,
): Promise<{
  success: boolean;
  category?: string;
  tags?: string[];
  title?: string;
  error?: string;
}> {
  try {
    const result = await categorizeTranscript(transcriptUrl);
    if (!result)
      return { success: false, error: "Categorization returned no result" };

    const existing = await dbGetById(id);
    const needsTitleFix =
      !existing?.title ||
      existing.title === "Untitled" ||
      existing.title === "Instagram" ||
      existing.title.includes("Instagram Post");

    await dbUpdateCategory(
      id,
      result.category,
      result.tags,
      needsTitleFix ? result.title : undefined,
    );
    // Note: revalidateTag omitted here — caller updates local state directly
    return {
      success: true,
      category: result.category,
      tags: result.tags,
      title: needsTitleFix ? result.title : existing?.title,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[categorizeItem]", err);
    return { success: false, error: message };
  }
}

export async function categorizeTranscriptAction(
  transcriptUrl: string,
): Promise<{
  success: boolean;
  category?: string;
  tags?: string[];
  title?: string;
  error?: string;
}> {
  try {
    const result = await categorizeTranscript(transcriptUrl);
    if (!result)
      return { success: false, error: "Categorization returned no result" };
    return {
      success: true,
      category: result.category,
      tags: result.tags,
      title: result.title,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[categorizeTranscriptAction]", err);
    return { success: false, error: message };
  }
}

export async function getMediaItemById(id: string): Promise<MediaItem | null> {
  return dbGetById(id);
}

export async function softDeleteMediaItem(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = await dbSoftDeleteMediaItem(id);
    if (!deleted) {
      return { success: false, error: "Item not found" };
    }
    revalidateTag("media");
    return { success: true };
  } catch (err) {
    console.error("[softDeleteMediaItem]", err);
    return { success: false, error: "Failed to hide media item" };
  }
}

function validatePersonalAccessKey(key: string): string | null {
  if (!key.trim()) return "Access key is required";
  if (key.trim().length < 8) return "Access key must be at least 8 characters";
  return null;
}

async function grantPersonalAccess(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PERSONAL_ACCESS_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/omoinjm",
  });
}

export async function hasPersonalAccessConfigured(): Promise<boolean> {
  return dbHasPersonalAccessKey();
}

export async function setupPersonalAccessKey(
  key: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const validationError = validatePersonalAccessKey(key);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const created = await dbCreatePersonalAccessKey(key.trim());
    if (!created) {
      return { success: false, error: "Personal access is already configured" };
    }

    await grantPersonalAccess();
    return { success: true };
  } catch (err) {
    console.error("[setupPersonalAccessKey]", err);
    return { success: false, error: "Failed to create personal access key" };
  }
}

export async function unlockPersonalRoute(
  key: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const validationError = validatePersonalAccessKey(key);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const verified = await dbVerifyPersonalAccessKey(key.trim());
    if (!verified) {
      return { success: false, error: "Invalid access key" };
    }

    await grantPersonalAccess();
    return { success: true };
  } catch (err) {
    console.error("[unlockPersonalRoute]", err);
    return { success: false, error: "Failed to verify access key" };
  }
}
