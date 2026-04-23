"use server";

import OpenAI from "openai";
import { getSubtitles } from "youtube-caption-extractor";
import { env } from "@/lib/env";
import type { MediaItem } from "@/types/media";
import type { GuestConfig } from "@/lib/guest-config";
import type { ActionResponse } from "@/types/api";

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
}

const NOTES_SYSTEM_PROMPT = `You are a structured notes assistant. Given a video transcript, produce well-formatted Markdown notes.

Include:
- ## Summary (2-3 sentences)
- ## Key Moments (Detailed bullet points. Format: **Topic Title**: Brief description with timestamp ranges like (MM:SS-MM:SS))
- ## Key Points (Bullet list of high-level takeaways)
- ## Action Items (If any practical takeaways)

Use proper Markdown formatting. Be concise but comprehensive. Ensure timestamps are included for key moments.`;

/**
 * Fetches captions/subtitles for a YouTube video.
 */
async function transcribeYouTubeCaptions(videoId: string): Promise<string> {
  try {
    let subtitles = await getSubtitles({ videoID: videoId });
    if (!subtitles || subtitles.length === 0) {
      subtitles = await getSubtitles({ videoID: videoId, lang: "en" });
    }
    if (!subtitles || subtitles.length === 0) {
      throw new Error("No captions found for this YouTube video");
    }

    return subtitles.map((sub) => {
      const startTime = Math.floor(parseFloat(sub.start));
      const mins = Math.floor(startTime / 60);
      const secs = startTime % 60;
      const timestamp = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      return `[${timestamp}] ${sub.text}`;
    }).join("\n");
  } catch (err) {
    throw new Error(`Failed to get YouTube captions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Transcribes an audio/video file using OpenAI Whisper.
 */
async function transcribeWithOpenAI(
  originalUrl: string,
  videoId: string,
  apiKey: string,
): Promise<string> {
  const mediaRes = await fetch(originalUrl);
  if (!mediaRes.ok) throw new Error(`Failed to fetch media: ${mediaRes.status}`);

  const contentType = mediaRes.headers.get("content-type") ?? "";
  const arrayBuffer = await mediaRes.arrayBuffer();
  const file = new File([Buffer.from(arrayBuffer)], `${videoId}.media`, {
    type: contentType || "application/octet-stream",
  });
  
  const client = new OpenAI({ apiKey });
  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  if (!transcription.text?.trim()) throw new Error("OpenAI returned an empty transcript");
  return transcription.text.trim();
}

/**
 * Transcribes an audio/video file using Google Gemini 1.5 Flash.
 */
async function transcribeWithGemini(
  originalUrl: string,
  apiKey: string,
): Promise<string> {
  const mediaRes = await fetch(originalUrl);
  if (!mediaRes.ok) throw new Error(`Failed to fetch media: ${mediaRes.status}`);

  const contentType = mediaRes.headers.get("content-type") ?? "";
  const arrayBuffer = await mediaRes.arrayBuffer();
  const base64Content = Buffer.from(arrayBuffer).toString("base64");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Please transcribe this audio/video content into plain text. Provide only the transcription, no additional commentary." },
              { inlineData: { mimeType: contentType || "application/octet-stream", data: base64Content } },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
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

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = (await res.json()) as AnthropicMessageResponse;
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: { text: NOTES_SYSTEM_PROMPT } },
        generationConfig: { maxOutputTokens: 2048 },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini returned empty notes");
  return text;
}

/**
 * Generates structured Markdown notes from a transcript using various AI providers.
 */
async function generateNotesMarkdown(
  transcriptText: string,
  config: Pick<GuestConfig, "llmProvider" | "llmApiKey" | "llmModel">,
): Promise<string> {
  const userPrompt = `Here is the video transcript:\n\n${transcriptText.slice(0, 12000)}\n\nPlease generate structured notes.`;

  if (config.llmProvider === "openai" || config.llmProvider === "groq") {
    const client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmProvider === "groq" ? "https://api.groq.com/openai/v1" : undefined,
    });
    const completion = await client.chat.completions.create({
      model: config.llmModel || (config.llmProvider === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini"),
      messages: [
        { role: "system", content: NOTES_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error(`${config.llmProvider} returned empty notes`);
    return content;
  }

  if (config.llmProvider === "anthropic") {
    return callAnthropic(config.llmApiKey, config.llmModel || "claude-3-haiku-20240307", userPrompt);
  }

  if (config.llmProvider === "gemini") {
    return callGemini(config.llmApiKey, config.llmModel || "gemini-1.5-flash", userPrompt);
  }

  throw new Error(`Unsupported notes provider: ${config.llmProvider}`);
}

export async function generatePublicTranscript(input: {
  item: Pick<MediaItem, "id" | "url" | "platform" | "videoId" | "title">;
  config: Pick<GuestConfig, "transcribeProvider" | "transcribeApiKey">;
}): Promise<ActionResponse<string>> {
  try {
    const { item, config } = input;
    let transcriptText: string;

    if (item.platform === "youtube") {
      transcriptText = await transcribeYouTubeCaptions(item.videoId);
    } else if (config.transcribeProvider === "openai") {
      transcriptText = await transcribeWithOpenAI(item.url, item.videoId, config.transcribeApiKey);
    } else if (config.transcribeProvider === "gemini") {
      transcriptText = await transcribeWithGemini(item.url, config.transcribeApiKey);
    } else {
      return { success: false, error: "Unsupported provider" };
    }

    return { success: true, data: transcriptText };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function generatePublicNotes(input: {
  item: Pick<MediaItem, "id" | "platform" | "videoId" | "transcriptUrl" | "title">;
  config: Pick<GuestConfig, "llmProvider" | "llmApiKey" | "llmModel">;
  transcriptContent: string;
}): Promise<ActionResponse<string>> {
  try {
    const notes = await generateNotesMarkdown(input.transcriptContent, input.config);
    return { success: true, data: notes };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function generateTranscriptQuestions(
  transcriptText: string,
  title: string
): Promise<string[]> {
  try {
    const token = env.githubToken;
    if (!token) return [];
    
    const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: token });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates exactly 4 short, engaging questions based on a transcript. Your response MUST be a JSON array of strings. Do not include any other text."
        },
        {
          role: "user",
          content: `Title: "${title}"\nTranscript snippet: ${transcriptText.slice(0, 3000)}`
        }
      ],
      max_tokens: 300,
    });
    
    const content = response.choices[0]?.message?.content?.trim() ?? "[]";
    // Clean potential markdown blocks
    const cleanJson = content.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 4);
    }
    
    // Fallback for object format
    if (typeof parsed === 'object' && parsed !== null) {
      const firstArray = Object.values(parsed).find(Array.isArray);
      if (firstArray) return firstArray.slice(0, 4);
    }

    return [];
  } catch (err) {
    console.error("[generateTranscriptQuestions] Error:", err);
    return [];
  }
}

export async function answerTranscriptQuestion(
  question: string,
  transcriptText: string,
  title: string
): Promise<string> {
  try {
    const token = env.githubToken;
    if (!token) return "AI services are not configured.";
    
    const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: token });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are answering about "${title}".` },
        { role: "user", content: `Question: ${question}\n\nTranscript: ${transcriptText.slice(0, 4000)}` }
      ],
      max_tokens: 400,
    });
    return response.choices[0]?.message?.content ?? "No answer";
  } catch (err) {
    console.error("[answerTranscriptQuestion] Error:", err);
    return "Failed to get answer";
  }
}
