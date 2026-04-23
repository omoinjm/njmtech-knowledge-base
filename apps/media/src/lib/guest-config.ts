"use client";

import {
  clearEncryptedJson,
  exportEncryptedJsonToFragment,
  importEncryptedJsonFromFragment,
  loadEncryptedJson,
  saveEncryptedJson,
} from "./secure-local-storage";

export interface GuestConfig {
  transcribeProvider: "youtube-captions" | "openai" | "gemini";
  transcribeApiKey: string;
  llmProvider: "openai" | "groq" | "anthropic" | "gemini";
  llmApiKey: string;
  llmModel: string;
}

export const TRANSCRIBE_PROVIDER_OPTIONS = [
  {
    value: "youtube-captions",
    label: "YouTube captions",
    description: "Best for YouTube links that already have captions.",
    apiKeyLabel: "No API key required",
  },
  {
    value: "openai",
    label: "OpenAI audio transcription",
    description: "Use Whisper for direct audio or video file URLs.",
    apiKeyLabel: "OpenAI API key required",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Gemini API for audio/video transcription.",
    apiKeyLabel: "Google API key required",
  },
] as const satisfies ReadonlyArray<{
  value: GuestConfig["transcribeProvider"];
  label: string;
  description: string;
  apiKeyLabel: string;
}>;

export const NOTES_PROVIDER_OPTIONS = [
  {
    value: "openai",
    label: "OpenAI",
    description: "General-purpose notes generation.",
    defaultModel: "gpt-4o-mini",
  },
  {
    value: "groq",
    label: "Groq",
    description: "Fast OpenAI-compatible inference.",
    defaultModel: "llama-3.1-8b-instant",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    description: "Claude models for structured summaries.",
    defaultModel: "claude-3-haiku-20240307",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Gemini models for comprehensive notes.",
    defaultModel: "gemini-1.5-flash",
  },
] as const satisfies ReadonlyArray<{
  value: GuestConfig["llmProvider"];
  label: string;
  description: string;
  defaultModel: string;
}>;

export const NOTES_MODEL_OPTIONS = {
  openai: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { value: "gpt-4.1", label: "gpt-4.1" },
  ],
  groq: [
    { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant" },
    { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
    { value: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768" },
  ],
  anthropic: [
    { value: "claude-3-haiku-20240307", label: "claude-3-haiku-20240307" },
    { value: "claude-3-5-haiku-latest", label: "claude-3-5-haiku-latest" },
    { value: "claude-3-5-sonnet-latest", label: "claude-3-5-sonnet-latest" },
  ],
  gemini: [
    { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    { value: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { value: "gemini-2.0-flash", label: "gemini-2.0-flash" },
  ],
} as const satisfies Record<
  GuestConfig["llmProvider"],
  ReadonlyArray<{ value: string; label: string }>
>;

export function getTranscribeProviderLabel(provider: GuestConfig["transcribeProvider"]): string {
  return TRANSCRIBE_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function getNotesProviderLabel(provider: GuestConfig["llmProvider"]): string {
  return NOTES_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function getDefaultNotesModel(provider: GuestConfig["llmProvider"]): string {
  return (
    NOTES_PROVIDER_OPTIONS.find((option) => option.value === provider)?.defaultModel ?? "gpt-4o-mini"
  );
}

export function getNotesModelOptions(provider: GuestConfig["llmProvider"]) {
  return NOTES_MODEL_OPTIONS[provider];
}

const STORAGE_KEY = "mhs_guest_config";
const KEY_STORAGE = "mhs_guest_key";
const SHARE_STORAGE_KEY = "mhs_guest_share_token";

export async function saveGuestConfig(config: GuestConfig): Promise<void> {
  await saveEncryptedJson(STORAGE_KEY, KEY_STORAGE, config);
}

export async function loadGuestConfig(): Promise<GuestConfig | null> {
  return loadEncryptedJson<GuestConfig>(STORAGE_KEY, KEY_STORAGE);
}

export function clearGuestConfig(): void {
  clearEncryptedJson(STORAGE_KEY, KEY_STORAGE);
  localStorage.removeItem(SHARE_STORAGE_KEY);
}

export async function createGuestConfigShareToken(
  config: GuestConfig,
  passphrase: string
): Promise<string> {
  return exportEncryptedJsonToFragment(config, passphrase);
}

export function cacheGuestConfigShareToken(token: string): void {
  localStorage.setItem(SHARE_STORAGE_KEY, token);
}

export function loadCachedGuestConfigShareToken(): string | null {
  return localStorage.getItem(SHARE_STORAGE_KEY);
}

export function buildGuestConfigRestoreUrl(token: string): string {
  return `${window.location.origin}/setup#cfg=${token}`;
}

export async function exportConfigToUrl(
  config: GuestConfig,
  passphrase: string
): Promise<string> {
  const encoded = await createGuestConfigShareToken(config, passphrase);
  cacheGuestConfigShareToken(encoded);
  return buildGuestConfigRestoreUrl(encoded);
}

export async function importConfigFromFragment(
  fragment: string,
  passphrase: string
): Promise<GuestConfig> {
  return importEncryptedJsonFromFragment<GuestConfig>(fragment, passphrase);
}
