"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, Loader2, Settings2, TriangleAlert, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildGuestConfigRestoreUrl,
  cacheGuestConfigShareToken,
  createGuestConfigShareToken,
  clearGuestConfig,
  getDefaultNotesModel,
  getNotesModelOptions,
  importConfigFromFragment,
  loadCachedGuestConfigShareToken,
  loadGuestConfig,
  NOTES_PROVIDER_OPTIONS,
  saveGuestConfig,
  TRANSCRIBE_PROVIDER_OPTIONS,
  type GuestConfig,
} from "@/lib/guest-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface PublicModeSettingsProps {
  onConfigChange: (config: GuestConfig | null) => void;
}

const DEFAULT_CONFIG: GuestConfig = {
  transcribeProvider: "youtube-captions",
  transcribeApiKey: "",
  llmProvider: "openai",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
};

function getConfigTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get("cfg");
}

interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
  htmlFor?: string;
}

function LabelWithTooltip({ label, tooltip, htmlFor }: LabelWithTooltipProps) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <label className="block text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={14} className="text-muted-foreground cursor-help hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function PublicModeSettings({ onConfigChange }: PublicModeSettingsProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<GuestConfig>(DEFAULT_CONFIG);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [restoreUrl, setRestoreUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const restoreToken = useMemo(() => getConfigTokenFromHash(), []);

  const notesModelOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = getNotesModelOptions(config.llmProvider).map(
      (option) => ({
        value: option.value,
        label: option.label,
      })
    );
    const hasCurrentValue = options.some((option) => option.value === config.llmModel);

    if (config.llmModel && !hasCurrentValue) {
      options.push({
        value: config.llmModel,
        label: `${config.llmModel} (saved custom)`,
      });
    }

    return options;
  }, [config.llmModel, config.llmProvider]);

  const syncRestoreArtifacts = async (
    nextConfig: GuestConfig,
    options?: { forceRefresh?: boolean; passphrase?: string }
  ) => {
    const cachedToken = options?.forceRefresh ? null : loadCachedGuestConfigShareToken();
    if (!cachedToken && !options?.passphrase) {
      setRestoreUrl(null);
      setQrCodeUrl(null);
      return;
    }

    const token = cachedToken ?? (await createGuestConfigShareToken(nextConfig, options.passphrase));

    if (!cachedToken || options?.forceRefresh) {
      cacheGuestConfigShareToken(token);
    }

    const nextRestoreUrl = buildGuestConfigRestoreUrl(token);
    setRestoreUrl(nextRestoreUrl);
    setQrCodeUrl(
      await QRCode.toDataURL(nextRestoreUrl, {
        width: 240,
        margin: 1,
      })
    );
  };

  useEffect(() => {
    loadGuestConfig().then((stored) => {
      if (stored) {
        const normalized = {
          ...DEFAULT_CONFIG,
          ...stored,
          transcribeProvider:
            stored.transcribeProvider === "openai" || stored.transcribeProvider === "gemini"
              ? stored.transcribeProvider
              : "youtube-captions",
          llmProvider:
            stored.llmProvider === "groq" || stored.llmProvider === "anthropic"
              ? stored.llmProvider
              : "openai",
          llmModel:
            stored.llmModel?.trim() ||
            getDefaultNotesModel(
              stored.llmProvider === "groq" || stored.llmProvider === "anthropic"
                ? stored.llmProvider
                : "openai"
            ),
        } satisfies GuestConfig;
        setConfig(normalized);
        setHasSavedConfig(true);
        onConfigChange(normalized);
        void syncRestoreArtifacts(normalized);
      }
    });
  }, [onConfigChange]);

  useEffect(() => {
    if (restoreToken && !hasSavedConfig) {
      setShowRestoreModal(true);
    }
  }, [restoreToken, hasSavedConfig]);

  const handleRestoreFromUrl = () => {
    setRestoreError(null);
    if (!restoreToken) {
      setRestoreError("This restore link is missing the saved settings payload.");
      return;
    }

    if (restorePassphrase.trim().length < 8) {
      setRestoreError("Enter the restore passphrase used when the QR code was created.");
      return;
    }

    startTransition(async () => {
      try {
        const importedConfig = await importConfigFromFragment(restoreToken, restorePassphrase.trim());
        await saveGuestConfig(importedConfig);
        cacheGuestConfigShareToken(restoreToken);

        const normalized = {
          ...DEFAULT_CONFIG,
          ...importedConfig,
          transcribeProvider:
            importedConfig.transcribeProvider === "openai" || importedConfig.transcribeProvider === "gemini"
              ? importedConfig.transcribeProvider
              : "youtube-captions",
          llmProvider:
            importedConfig.llmProvider === "groq" || importedConfig.llmProvider === "anthropic"
              ? importedConfig.llmProvider
              : "openai",
          llmModel: importedConfig.llmModel?.trim() || getDefaultNotesModel(importedConfig.llmProvider),
        } satisfies GuestConfig;

        setConfig(normalized);
        setHasSavedConfig(true);
        onConfigChange(normalized);
        setRestorePassphrase("");
        setShowRestoreModal(false);

        if (typeof window !== "undefined") {
          window.location.hash = "";
        }
      } catch {
        setRestoreError("The passphrase is wrong or this restore link is invalid.");
      }
    });
  };

  const handleSave = () => {
    setError(null);
    const normalizedPassphrase = restorePassphrase.trim();
    if (normalizedPassphrase.length < 8) {
      setError("Restore passphrase must be at least 8 characters");
      return;
    }
    const normalizedConfig: GuestConfig = {
      transcribeProvider: config.transcribeProvider,
      transcribeApiKey: config.transcribeApiKey.trim(),
      llmProvider: config.llmProvider,
      llmApiKey: config.llmApiKey.trim(),
      llmModel: config.llmModel.trim() || getDefaultNotesModel(config.llmProvider),
    };

    startTransition(async () => {
      await saveGuestConfig(normalizedConfig);
      await syncRestoreArtifacts(normalizedConfig, {
        forceRefresh: true,
        passphrase: normalizedPassphrase,
      });
      setConfig(normalizedConfig);
      setHasSavedConfig(true);
      setCopied(false);
      setRestorePassphrase("");
      onConfigChange(normalizedConfig);
      setOpen(false);
    });
  };

  const handleClear = () => {
    startTransition(async () => {
      clearGuestConfig();
      setConfig(DEFAULT_CONFIG);
      setHasSavedConfig(false);
      setRestoreUrl(null);
      setQrCodeUrl(null);
      setCopied(false);
      setRestorePassphrase("");
      onConfigChange(null);
      setError(null);
    });
  };

  const handleCopyRestoreUrl = async () => {
    if (!restoreUrl) return;
    await navigator.clipboard.writeText(restoreUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Restore from URL Modal */}
      <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Public settings</DialogTitle>
            <DialogDescription>
              Enter the restore passphrase to import the saved Public settings.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRestoreFromUrl();
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="restore-passphrase-modal">
                Restore passphrase
              </label>
              <input
                id="restore-passphrase-modal"
                type="password"
                value={restorePassphrase}
                onChange={(event) => setRestorePassphrase(event.target.value)}
                placeholder="Enter the passphrase used when sharing"
                className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {restoreError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3">
                <TriangleAlert size={16} className="mt-0.5 flex-shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{restoreError}</p>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Restoring…
                  </>
                ) : (
                  "Restore settings"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Settings2 size={13} />
          {hasSavedConfig ? "Providers & tokens" : "Set up public mode"}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
            <DialogTitle>Public mode settings</DialogTitle>
            <DialogDescription>
              Pick your transcript and notes providers. Tokens are stored in encrypted browser storage for this browser only.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <LabelWithTooltip
                label="Restore passphrase"
                htmlFor="restore-passphrase"
                tooltip="Create a strong passphrase to protect your QR code and restore link. This passphrase is required when restoring settings on another device. Not stored anywhere."
              />
              <input
                id="restore-passphrase"
                type="password"
                value={restorePassphrase}
                onChange={(event) => setRestorePassphrase(event.target.value)}
                placeholder="Use this to protect the QR restore link"
                className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This passphrase is not stored. It is required to generate a new QR code and to restore settings on another device.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Transcript provider</h3>
                  <p className="text-xs text-muted-foreground">Choose how Public mode should generate transcripts.</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={14} className="text-muted-foreground cursor-help hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs"><strong>YouTube captions:</strong> Free, for videos with captions. <strong>OpenAI:</strong> Requires API key, works with audio/video URLs.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid gap-2">
                {TRANSCRIBE_PROVIDER_OPTIONS.map((option) => {
                  const active = config.transcribeProvider === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          transcribeProvider: option.value,
                        }))
                      }
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{option.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                        </div>
                        {active && <CheckCircle2 size={16} className="text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div>
                <LabelWithTooltip
                  label="Transcript API key"
                  htmlFor="transcribe-api-key"
                  tooltip={
                    config.transcribeProvider === "youtube-captions"
                      ? "Not required for YouTube captions. Leave empty if using YouTube videos with captions."
                      : config.transcribeProvider === "openai"
                        ? "OpenAI API key starting with 'sk-'. Get from https://platform.openai.com/api-keys. Required for transcribing non-YouTube media."
                        : "Google API key from https://ai.google.dev/. Required for Gemini transcription."
                  }
                />
                <input
                  id="transcribe-api-key"
                  type="password"
                  value={config.transcribeApiKey}
                  onChange={(event) => setConfig((prev) => ({ ...prev, transcribeApiKey: event.target.value }))}
                  placeholder={config.transcribeProvider === "youtube-captions" ? "Not required" : "sk-..."}
                  className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {
                    TRANSCRIBE_PROVIDER_OPTIONS.find((option) => option.value === config.transcribeProvider)
                      ?.apiKeyLabel
                  }
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Notes provider</h3>
                  <p className="text-xs text-muted-foreground">Choose which provider should turn transcripts into markdown notes.</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={14} className="text-muted-foreground cursor-help hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs"><strong>OpenAI:</strong> Most capable, gpt-4o recommended. <strong>Groq:</strong> Fast, free tier available. <strong>Anthropic:</strong> Claude models, structured output. <strong>Gemini:</strong> Fast and capable, free tier available.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid gap-2">
                {NOTES_PROVIDER_OPTIONS.map((option) => {
                  const active = config.llmProvider === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          llmProvider: option.value,
                          llmModel: option.defaultModel,
                        }))
                      }
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{option.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {option.description} Default model: {option.defaultModel}
                          </p>
                        </div>
                        {active && <CheckCircle2 size={16} className="text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <LabelWithTooltip
                    label="Notes model"
                    htmlFor="llm-model"
                    tooltip={`Select the specific model to use for generating notes. Different models have different quality and cost. Options change based on selected provider. ${config.llmProvider === "openai" ? "gpt-4o recommended for best quality." : config.llmProvider === "groq" ? "llama-3.3-70b recommended." : "claude-3-5-sonnet recommended."}`}
                  />
                  <Select
                    value={config.llmModel}
                    onValueChange={(value) => setConfig((prev) => ({ ...prev, llmModel: value }))}
                  >
                    <SelectTrigger
                      id="llm-model"
                      className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <SelectValue placeholder={getDefaultNotesModel(config.llmProvider)} />
                    </SelectTrigger>
                    <SelectContent>
                      {notesModelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Models shown here update when you switch notes provider.
                  </p>
                </div>
                <div>
                  <LabelWithTooltip
                    label="Notes API key"
                    htmlFor="llm-api-key"
                    tooltip={
                      config.llmProvider === "openai"
                        ? "OpenAI API key starting with 'sk-'. Get from https://platform.openai.com/api-keys"
                        : config.llmProvider === "groq"
                          ? "Groq API key from https://console.groq.com. Free tier available."
                          : config.llmProvider === "anthropic"
                            ? "Anthropic API key from https://console.anthropic.com"
                            : "Google API key from https://ai.google.dev/. Free tier available."
                    }
                  />
                  <input
                    id="llm-api-key"
                    type="password"
                    value={config.llmApiKey}
                    onChange={(event) => setConfig((prev) => ({ ...prev, llmApiKey: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {restoreUrl && qrCodeUrl && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Restore link</h3>
                  <p className="text-xs text-muted-foreground">
                    This QR code and link are cached after save. Opening the link still requires the restore passphrase before settings can be imported.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
                  <Image
                    src={qrCodeUrl}
                    alt="QR code for restoring public settings"
                    width={192}
                    height={192}
                    unoptimized
                    className="h-48 w-48 rounded-lg bg-white p-2"
                  />
                  <div className="w-full break-all rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    {restoreUrl}
                  </div>
                  <Button type="button" variant="outline" onClick={handleCopyRestoreUrl} className="w-full sm:w-auto">
                    <Copy />
                    {copied ? "Copied" : "Copy restore link"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:space-x-2">
            {hasSavedConfig && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
              Save settings
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
