package bootstrap

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/joho/godotenv"
	"yt-transcribe/pkg/downloader"
	"yt-transcribe/pkg/transcriber"
	"yt-transcribe/pkg/uploader"
	"yt-transcribe/pkg/secrets"
	"yt-transcribe/src"
)

var loadDotEnvOnce sync.Once

// Config holds application configuration loaded from environment or Infisical.
type Config struct {
	WhisperModelPath        string
	VercelBlobAPIURL        string
	VercelBlobAPIToken      string
	PostgresURL             string
	YTDLPCookiesFile        string
	YTDLPCookiesFromBrowser string
}

func loadDotEnv() {
	loadDotEnvOnce.Do(func() {
		if err := godotenv.Load(); err != nil {
			log.Println("Note: No .env file found or error loading .env file. Proceeding without .env variables.")
		}
	})
}

// LoadConfigFromEnv loads all configuration from environment or Infisical.
func LoadConfigFromEnv(ctx context.Context) (*Config, error) {
	loadDotEnv()

	// Optional Infisical configuration: set INFISICAL_ENABLED=true, INFISICAL_PROJECT_ID and INFISICAL_ENVIRONMENT
	infisicalProjectID := os.Getenv("INFISICAL_PROJECT_ID")
	infisicalEnvironment := os.Getenv("INFISICAL_ENVIRONMENT")
	infisicalEnabled := os.Getenv("INFISICAL_ENABLED") == "true"

	log.Println("=== Loading Configuration ===")
	if infisicalEnabled {
		log.Printf("Infisical is enabled (project: %s, environment: %s)", infisicalProjectID, infisicalEnvironment)
	} else {
		log.Println("Infisical is disabled; reading from environment variables only")
	}

	whisperModelPath, err := secrets.GetSecret(ctx, "WHISPER_MODEL_PATH", "WHISPER_MODEL_PATH", infisicalProjectID, infisicalEnvironment)
	if err != nil {
		return nil, err
	}
	if whisperModelPath == "" {
		return nil, fmt.Errorf("WHISPER_MODEL_PATH not set")
	}
	logSecretLoaded("WHISPER_MODEL_PATH")

	vercelBlobAPIURL, err := secrets.GetSecret(ctx, "VERCEL_BLOB_API_URL", "VERCEL_BLOB_API_URL", infisicalProjectID, infisicalEnvironment)
	if err != nil {
		return nil, err
	}
	if vercelBlobAPIURL == "" {
		return nil, fmt.Errorf("VERCEL_BLOB_API_URL not set")
	}
	logSecretLoaded("VERCEL_BLOB_API_URL")

	vercelBlobAPIToken, err := secrets.GetSecret(ctx, "VERCEL_BLOB_API_TOKEN", "VERCEL_BLOB_API_TOKEN", infisicalProjectID, infisicalEnvironment)
	if err != nil {
		return nil, err
	}
	if vercelBlobAPIToken == "" {
		return nil, fmt.Errorf("VERCEL_BLOB_API_TOKEN not set")
	}
	logSecretLoaded("VERCEL_BLOB_API_TOKEN")

	// POSTGRES_URL is optional (only needed for -db mode)
	postgresURL, err := secrets.GetSecret(ctx, "POSTGRES_URL", "POSTGRES_URL", infisicalProjectID, infisicalEnvironment)
	if err != nil {
		// If POSTGRES_URL is not found and Infisical is not enabled, return empty string (optional)
		postgresURL = ""
		log.Println("POSTGRES_URL: not set (optional)")
	} else if postgresURL != "" {
		logSecretLoaded("POSTGRES_URL")
	} else {
		log.Println("POSTGRES_URL: not set (optional)")
	}

	// yt-dlp cookie options are optional
	ytdlpCookiesFile, _ := secrets.GetSecret(ctx, "YT_DLP_COOKIES_FILE", "YT_DLP_COOKIES_FILE", infisicalProjectID, infisicalEnvironment)
	if ytdlpCookiesFile != "" {
		logSecretLoaded("YT_DLP_COOKIES_FILE")
	}

	ytdlpCookiesFromBrowser, _ := secrets.GetSecret(ctx, "YT_DLP_COOKIES_FROM_BROWSER", "YT_DLP_COOKIES_FROM_BROWSER", infisicalProjectID, infisicalEnvironment)
	if ytdlpCookiesFromBrowser != "" {
		logSecretLoaded("YT_DLP_COOKIES_FROM_BROWSER")
	}

	log.Println("=== Configuration Loaded Successfully ===")

	return &Config{
		WhisperModelPath:        whisperModelPath,
		VercelBlobAPIURL:        vercelBlobAPIURL,
		VercelBlobAPIToken:      vercelBlobAPIToken,
		PostgresURL:             postgresURL,
		YTDLPCookiesFile:        ytdlpCookiesFile,
		YTDLPCookiesFromBrowser: ytdlpCookiesFromBrowser,
	}, nil
}

// logSecretLoaded logs that a secret was successfully loaded (without revealing its value).
func logSecretLoaded(secretName string) {
	log.Printf("%s: ✓ loaded", secretName)
}

func NewTranscriptionServiceFromEnv() (src.TranscriptionService, error) {
	ctx := context.Background()
	cfg, err := LoadConfigFromEnv(ctx)
	if err != nil {
		return nil, err
	}

	videoDownloader := downloader.NewYTDLPAudioDownloader(cfg.YTDLPCookiesFile, cfg.YTDLPCookiesFromBrowser)
	audioTranscriber := transcriber.NewWhisperCPPTranscriber(cfg.WhisperModelPath)
	blobUploader := uploader.NewVercelBlobUploader(cfg.VercelBlobAPIURL, cfg.VercelBlobAPIToken, &http.Client{})

	return src.NewTranscriptionService(videoDownloader, audioTranscriber, blobUploader), nil
}
