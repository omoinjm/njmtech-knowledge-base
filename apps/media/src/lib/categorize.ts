import OpenAI from "openai";
import { CategorizeResult } from "@/types/api";
import { env } from "./env";

/**
 * System prompt for the content categorization AI.
 * Instructs the model on how to parse transcripts and format its JSON response.
 */
const CATEGORIZATION_SYSTEM_PROMPT = `You are a content categorization assistant. Given a video transcript, return:
1. A concise, high-quality, and descriptive title for the video (max 80 chars).
2. A single primary category (1-3 words, e.g. "Business & Sales", "Technology", "Personal Development", "Entertainment", "Health & Fitness", "Education", "Finance", "Marketing")
3. Up to 6 specific tags (lowercase, no hashtags, 1-2 words each)

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"title":"<title>","category":"<category>","tags":["tag1","tag2","tag3"]}`;

/**
 * Lazily initialises and returns an OpenAI client configured for GitHub Models.
 *
 * @returns Configured OpenAI client
 * @throws {Error} If GITHUB_TOKEN environment variable is missing
 */
function getClient(): OpenAI {
  const token = env.githubToken;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new OpenAI({
    baseURL: "https://models.inference.ai.azure.com",
    apiKey: token,
  });
}

/**
 * Analyzes a video transcript to generate a category, tags, and a refined title.
 * Uses gpt-4o-mini via the GitHub Models inference API.
 *
 * @param transcriptUrl - Public URL of the transcript .txt file
 * @returns Structured categorization result or null if the process fails
 *
 * @example
 * const result = await categorizeTranscript("https://example.com/transcript.txt");
 * if (result) console.log(result.category);
 */
export async function categorizeTranscript(
  transcriptUrl: string
): Promise<CategorizeResult | null> {
  try {
    const res = await fetch(transcriptUrl);
    if (!res.ok) return null;
    const text = await res.text();
    // Use first 4000 chars as a representative sample for the AI
    const excerpt = text.slice(0, 4000);

    const client = getClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CATEGORIZATION_SYSTEM_PROMPT },
        { role: "user", content: `Transcript:\n${excerpt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<CategorizeResult>;

    return {
      title: parsed.title ? String(parsed.title).slice(0, 100) : undefined,
      category: String(parsed.category ?? "Unknown").slice(0, 60),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).toLowerCase()).slice(0, 6)
        : [],
    };
  } catch (err) {
    console.error("[categorizeTranscript] Failed:", err);
    return null;
  }
}
