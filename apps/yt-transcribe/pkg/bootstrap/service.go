package bootstrap

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"

	"github.com/joho/godotenv"
	"yt-transcribe/pkg/downloader"
	"yt-transcribe/pkg/secrets"
	"yt-transcribe/pkg/transcriber"
	"yt-transcribe/pkg/uploader"
	"yt-transcribe/src"
)

var loadDotEnvOnce sync.Once

// Config holds application configuration loaded from environment or Infisical.
type Config struct {
	// TranscriberBackend selects which Transcriber implementation to use:
	// "v1" (default) runs the bundled whisper.cpp binary locally; "v2" sends
	// audio to Cloudflare Workers AI's hosted Whisper models instead.
	TranscriberBackend string

	WhisperModelPath string
	WhisperThreads   int
	WhisperExtraArgs string

	CloudflareAIAPIToken     string
	CloudflareAIModel        string
	CloudflareAIChunkSeconds int

	UploadBlobAPIURL        string
	UploadBlobAPIToken      string
	CloudflareAccountID     string
	CloudflareD1DatabaseID  string
	CloudflareD1APIToken    string
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

	// TRANSCRIBER_BACKEND picks which Transcriber implementation runs:
	// "v1" (default) is the local whisper.cpp binary, "v2" is Cloudflare
	// Workers AI. Everything below that's specific to one backend is only
	// required when that backend is selected.
	transcriberBackend, _ := secrets.GetSecret(ctx, "TRANSCRIBER_BACKEND", "TRANSCRIBER_BACKEND", infisicalProjectID, infisicalEnvironment)
	if transcriberBackend == "" {
		transcriberBackend = "v1"
	}
	if transcriberBackend != "v1" && transcriberBackend != "v2" {
		return nil, fmt.Errorf("TRANSCRIBER_BACKEND must be \"v1\" or \"v2\", got %q", transcriberBackend)
	}
	log.Printf("TRANSCRIBER_BACKEND: %s", transcriberBackend)

	var whisperModelPath string
	whisperThreads := 1
	whisperExtraArgs := ""
	var err error

	if transcriberBackend == "v1" {
		whisperModelPath, err = secrets.GetSecret(ctx, "WHISPER_MODEL_PATH", "WHISPER_MODEL_PATH", infisicalProjectID, infisicalEnvironment)
		if err != nil {
			return nil, err
		}
		if whisperModelPath == "" {
			return nil, fmt.Errorf("WHISPER_MODEL_PATH not set (required when TRANSCRIBER_BACKEND=v1)")
		}
		logSecretLoaded("WHISPER_MODEL_PATH")

		resolvedWhisperModelPath, err := transcriber.ResolveModelPath(whisperModelPath)
		if err != nil {
			return nil, err
		}
		if resolvedWhisperModelPath != whisperModelPath {
			log.Printf("WHISPER_MODEL_PATH %q not found; using bundled model %q", whisperModelPath, resolvedWhisperModelPath)
		}
		whisperModelPath = resolvedWhisperModelPath

		if rawThreads := os.Getenv("WHISPER_THREADS"); rawThreads != "" {
			parsed, parseErr := strconv.Atoi(rawThreads)
			if parseErr != nil || parsed <= 0 {
				return nil, fmt.Errorf("WHISPER_THREADS must be a positive integer")
			}
			whisperThreads = parsed
		}
		whisperExtraArgs = os.Getenv("WHISPER_EXTRA_ARGS")
	}

	uploadBlobAPIURL, err := secrets.GetSecret(
		ctx,
		"UPLOAD_BLOB_API_URL",
		"UPLOAD_BLOB_API_URL",
		infisicalProjectID,
		infisicalEnvironment,
	)
	if err != nil {
		return nil, err
	}
	if uploadBlobAPIURL == "" {
		return nil, fmt.Errorf("UPLOAD_BLOB_API_URL not set")
	}
	logSecretLoaded("UPLOAD_BLOB_API_URL")

	uploadBlobAPIToken, err := secrets.GetSecret(
		ctx,
		"UPLOAD_BLOB_API_TOKEN",
		"UPLOAD_BLOB_API_TOKEN",
		infisicalProjectID,
		infisicalEnvironment,
	)
	if err != nil {
		return nil, err
	}
	if uploadBlobAPIToken == "" {
		return nil, fmt.Errorf("UPLOAD_BLOB_API_TOKEN not set")
	}
	logSecretLoaded("UPLOAD_BLOB_API_TOKEN")

	// CLOUDFLARE_* D1 credentials are optional (only needed for -db / -reprocess-all mode)
	cloudflareAccountID, _ := secrets.GetSecret(ctx, "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID", infisicalProjectID, infisicalEnvironment)
	cloudflareD1DatabaseID, _ := secrets.GetSecret(ctx, "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_DATABASE_ID", infisicalProjectID, infisicalEnvironment)
	cloudflareD1APIToken, _ := secrets.GetSecret(ctx, "CLOUDFLARE_D1_API_TOKEN", "CLOUDFLARE_D1_API_TOKEN", infisicalProjectID, infisicalEnvironment)
	if cloudflareAccountID != "" && cloudflareD1DatabaseID != "" && cloudflareD1APIToken != "" {
		logSecretLoaded("CLOUDFLARE_ACCOUNT_ID")
		logSecretLoaded("CLOUDFLARE_D1_DATABASE_ID")
		logSecretLoaded("CLOUDFLARE_D1_API_TOKEN")
	} else {
		log.Println("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_D1_API_TOKEN: not set (optional)")
	}

	// CLOUDFLARE_AI_* is only required when TRANSCRIBER_BACKEND=v2.
	cloudflareAIAPIToken, _ := secrets.GetSecret(ctx, "CLOUDFLARE_AI_API_TOKEN", "CLOUDFLARE_AI_API_TOKEN", infisicalProjectID, infisicalEnvironment)
	cloudflareAIModel, _ := secrets.GetSecret(ctx, "CLOUDFLARE_AI_MODEL", "CLOUDFLARE_AI_MODEL", infisicalProjectID, infisicalEnvironment)
	if cloudflareAIAPIToken != "" {
		logSecretLoaded("CLOUDFLARE_AI_API_TOKEN")
	}

	cloudflareAIChunkSeconds := 0
	if raw := os.Getenv("CLOUDFLARE_AI_CHUNK_SECONDS"); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed <= 0 {
			return nil, fmt.Errorf("CLOUDFLARE_AI_CHUNK_SECONDS must be a positive integer")
		}
		cloudflareAIChunkSeconds = parsed
	}

	if transcriberBackend == "v2" {
		if cloudflareAccountID == "" {
			return nil, fmt.Errorf("CLOUDFLARE_ACCOUNT_ID not set (required when TRANSCRIBER_BACKEND=v2)")
		}
		if cloudflareAIAPIToken == "" {
			return nil, fmt.Errorf("CLOUDFLARE_AI_API_TOKEN not set (required when TRANSCRIBER_BACKEND=v2)")
		}
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
		TranscriberBackend:       transcriberBackend,
		WhisperModelPath:         whisperModelPath,
		WhisperThreads:           whisperThreads,
		WhisperExtraArgs:         whisperExtraArgs,
		CloudflareAIAPIToken:     cloudflareAIAPIToken,
		CloudflareAIModel:        cloudflareAIModel,
		CloudflareAIChunkSeconds: cloudflareAIChunkSeconds,
		UploadBlobAPIURL:         uploadBlobAPIURL,
		UploadBlobAPIToken:       uploadBlobAPIToken,
		CloudflareAccountID:      cloudflareAccountID,
		CloudflareD1DatabaseID:   cloudflareD1DatabaseID,
		CloudflareD1APIToken:     cloudflareD1APIToken,
		YTDLPCookiesFile:         ytdlpCookiesFile,
		YTDLPCookiesFromBrowser:  ytdlpCookiesFromBrowser,
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

	var audioTranscriber src.Transcriber
	switch cfg.TranscriberBackend {
	case "v2":
		audioTranscriber = transcriber.NewCloudflareAITranscriber(
			cfg.CloudflareAccountID,
			cfg.CloudflareAIAPIToken,
			cfg.CloudflareAIModel,
			cfg.CloudflareAIChunkSeconds,
			nil,
		)
	default:
		audioTranscriber = transcriber.NewWhisperCPPTranscriber(
			cfg.WhisperModelPath,
			cfg.WhisperThreads,
			transcriber.ParseWhisperExtraArgs(cfg.WhisperExtraArgs),
		)
	}

	blobUploader := uploader.NewBlobAPIUploader(
		cfg.UploadBlobAPIURL,
		cfg.UploadBlobAPIToken,
		&http.Client{},
	)

	return src.NewTranscriptionService(videoDownloader, audioTranscriber, blobUploader), nil
}
