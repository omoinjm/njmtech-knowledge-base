package bootstrap

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// clearOptionalEnv resets every env var LoadConfigFromEnv reads to empty, so
// tests are isolated from whatever happens to be set in the ambient shell
// environment (e.g. real Cloudflare credentials in a developer's .env).
func clearOptionalEnv(t *testing.T) {
	t.Helper()
	vars := []string{
		"TRANSCRIBER_BACKEND",
		"WHISPER_MODEL_PATH", "WHISPER_THREADS", "WHISPER_EXTRA_ARGS",
		"CLOUDFLARE_AI_API_TOKEN", "CLOUDFLARE_AI_MODEL", "CLOUDFLARE_AI_CHUNK_SECONDS",
		"UPLOAD_BLOB_API_URL", "UPLOAD_BLOB_API_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_API_TOKEN",
		"YT_DLP_COOKIES_FILE", "YT_DLP_COOKIES_FROM_BROWSER",
		"INFISICAL_ENABLED", "INFISICAL_PROJECT_ID", "INFISICAL_ENVIRONMENT",
	}
	for _, v := range vars {
		t.Setenv(v, "")
	}
}

// setRequiredCommonEnv sets the env vars every backend needs regardless of
// TRANSCRIBER_BACKEND (upload-blob credentials).
func setRequiredCommonEnv(t *testing.T) {
	t.Helper()
	t.Setenv("UPLOAD_BLOB_API_URL", "https://example.com/upload")
	t.Setenv("UPLOAD_BLOB_API_TOKEN", "upload-token")
}

func writeFakeWhisperModel(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ggml-test.bin")
	if err := os.WriteFile(path, []byte("fake model"), 0o600); err != nil {
		t.Fatalf("failed to write fake model file: %v", err)
	}
	return path
}

func TestLoadConfigFromEnv_DefaultsToV1(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("WHISPER_MODEL_PATH", writeFakeWhisperModel(t))

	cfg, err := LoadConfigFromEnv(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cfg.TranscriberBackend != "v1" {
		t.Errorf("expected default backend %q, got %q", "v1", cfg.TranscriberBackend)
	}
	if cfg.WhisperModelPath == "" {
		t.Error("expected WhisperModelPath to be set for the v1 backend")
	}
}

func TestLoadConfigFromEnv_V1RequiresWhisperModelPath(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	// TRANSCRIBER_BACKEND left unset -> defaults to v1, WHISPER_MODEL_PATH left unset.

	_, err := LoadConfigFromEnv(context.Background())
	if err == nil || !strings.Contains(err.Error(), "WHISPER_MODEL_PATH not set") {
		t.Fatalf("expected WHISPER_MODEL_PATH error, got: %v", err)
	}
}

func TestLoadConfigFromEnv_V2SkipsWhisperModelPathRequirement(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v2")
	t.Setenv("CLOUDFLARE_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_AI_API_TOKEN", "test-ai-token")
	// WHISPER_MODEL_PATH intentionally left unset.

	cfg, err := LoadConfigFromEnv(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cfg.TranscriberBackend != "v2" {
		t.Errorf("expected backend %q, got %q", "v2", cfg.TranscriberBackend)
	}
	if cfg.WhisperModelPath != "" {
		t.Errorf("expected WhisperModelPath to stay empty for the v2 backend, got %q", cfg.WhisperModelPath)
	}
	if cfg.CloudflareAIAPIToken != "test-ai-token" {
		t.Errorf("expected CloudflareAIAPIToken to be loaded, got %q", cfg.CloudflareAIAPIToken)
	}
}

func TestLoadConfigFromEnv_V2RequiresAccountID(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v2")
	t.Setenv("CLOUDFLARE_AI_API_TOKEN", "test-ai-token")
	// CLOUDFLARE_ACCOUNT_ID intentionally left unset.

	_, err := LoadConfigFromEnv(context.Background())
	if err == nil || !strings.Contains(err.Error(), "CLOUDFLARE_ACCOUNT_ID not set") {
		t.Fatalf("expected CLOUDFLARE_ACCOUNT_ID error, got: %v", err)
	}
}

func TestLoadConfigFromEnv_V2RequiresAIAPIToken(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v2")
	t.Setenv("CLOUDFLARE_ACCOUNT_ID", "test-account")
	// CLOUDFLARE_AI_API_TOKEN intentionally left unset.

	_, err := LoadConfigFromEnv(context.Background())
	if err == nil || !strings.Contains(err.Error(), "CLOUDFLARE_AI_API_TOKEN not set") {
		t.Fatalf("expected CLOUDFLARE_AI_API_TOKEN error, got: %v", err)
	}
}

func TestLoadConfigFromEnv_RejectsUnknownBackend(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v3")

	_, err := LoadConfigFromEnv(context.Background())
	if err == nil || !strings.Contains(err.Error(), "must be") {
		t.Fatalf("expected invalid-backend error, got: %v", err)
	}
}

func TestLoadConfigFromEnv_RejectsInvalidChunkSeconds(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v2")
	t.Setenv("CLOUDFLARE_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_AI_API_TOKEN", "test-ai-token")
	t.Setenv("CLOUDFLARE_AI_CHUNK_SECONDS", "not-a-number")

	_, err := LoadConfigFromEnv(context.Background())
	if err == nil || !strings.Contains(err.Error(), "CLOUDFLARE_AI_CHUNK_SECONDS must be a positive integer") {
		t.Fatalf("expected CLOUDFLARE_AI_CHUNK_SECONDS error, got: %v", err)
	}
}

func TestNewTranscriptionServiceFromEnv_SelectsBackend(t *testing.T) {
	clearOptionalEnv(t)
	setRequiredCommonEnv(t)
	t.Setenv("TRANSCRIBER_BACKEND", "v2")
	t.Setenv("CLOUDFLARE_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_AI_API_TOKEN", "test-ai-token")

	svc, err := NewTranscriptionServiceFromEnv()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if svc == nil {
		t.Fatal("expected a non-nil TranscriptionService")
	}
}
