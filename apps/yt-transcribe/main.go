package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	api "yt-transcribe/pkg/api"
	"yt-transcribe/pkg/bootstrap"
	"yt-transcribe/pkg/repository"
	"yt-transcribe/src"
)

const (
	DEFAULT_VIDEO_URL    = "https://www.youtube.com/watch?v=rdWZo5PD9Ek"
	URL_FLAG             = "url"
	OUTPUT_FLAG          = "output"
	DB_FLAG              = "db"
	REPROCESS_ALL_FLAG   = "reprocess-all"
	COOKIES_FILE_FLAG    = "cookies-file"
	COOKIES_BROWSER_FLAG = "cookies-from-browser"
)

func retryStatePath() string {
	if path := os.Getenv("YT_TRANSCRIBE_RETRY_STATE_FILE"); path != "" {
		return path
	}
	return defaultRetryStateFile
}

type healthResponse struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

// reportJobStatus POSTs the job result to JOB_CALLBACK_URL (if set) so the
// Worker can surface errors that would otherwise be invisible in wrangler tail.
func reportJobStatus(status, message string) {
	cbURL := os.Getenv("JOB_CALLBACK_URL")
	if cbURL == "" {
		return
	}
	body, _ := json.Marshal(map[string]string{"status": status, "message": message})
	req, err := http.NewRequest("POST", cbURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if token := os.Getenv("JOB_CALLBACK_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = http.DefaultClient.Do(req.WithContext(ctx))
}

// handleFatalError logs a fatal error and exits the program.
func handleFatalError(message string, err error) {
	fullMsg := message
	if err != nil {
		fullMsg = message + ": " + err.Error()
	}
	reportJobStatus("error", fullMsg)
	if err != nil {
		log.Fatalf("%s: %v", message, err)
	}
	log.Fatal(message)
}

func main() {
	// If explicit CLI args are provided (e.g. -db, -url, -reprocess-all),
	// prioritize worker/CLI mode even when PORT is set by platforms like Railway.
	if len(os.Args) > 1 {
		runCLI()
		return
	}

	if port := os.Getenv("PORT"); port != "" {
		runServer(port)
		return
	}

	runCLI()
}

func runCLI() {
	// Define command-line flags
	videoURL := flag.String(URL_FLAG, "", "Video URL to download audio from. Can also be provided as a positional argument.")
	outputDir := flag.String(OUTPUT_FLAG, os.TempDir(), "Directory to save downloaded audio")
	useDB := flag.Bool(DB_FLAG, false, "Fetch the next unprocessed video URL from the database instead of using -url")
	reprocessAll := flag.Bool(REPROCESS_ALL_FLAG, false, "Re-transcribe every record in the database, overwriting existing transcript URLs")
	cookiesFile := flag.String(COOKIES_FILE_FLAG, "", "Path to a cookies file for yt-dlp")
	cookiesFromBrowser := flag.String(COOKIES_BROWSER_FLAG, "", "Browser name to extract cookies from (e.g., chrome, firefox)")
	flag.Parse()

	if *cookiesFile != "" {
		os.Setenv("YT_DLP_COOKIES_FILE", *cookiesFile)
	}
	if *cookiesFromBrowser != "" {
		os.Setenv("YT_DLP_COOKIES_FROM_BROWSER", *cookiesFromBrowser)
	}

	transcriptionService, err := bootstrap.NewTranscriptionServiceFromEnv()
	if err != nil {
		handleFatalError("Failed to initialize transcription service", err)
	}

	ctx := context.Background()

	// Ensure the output directory exists
	if err := os.MkdirAll(*outputDir, 0755); err != nil {
		handleFatalError(fmt.Sprintf("Error creating output directory %s", *outputDir), err)
	}

	if *reprocessAll {
		runReprocessAll(ctx, transcriptionService, *outputDir)
	} else if *useDB {
		runFromDB(ctx, transcriptionService, *outputDir)
	} else {
		runFromCLI(ctx, transcriptionService, *videoURL, *outputDir)
	}
}

func runServer(port string) {
	var (
		svc     src.TranscriptionService
		svcErr  error
		svcOnce sync.Once
	)

	// Kick off service initialisation in the background so the HTTP server can
	// bind to its port immediately. Cloudflare's startAndWaitForPorts health
	// check will succeed as soon as the port is open; the transcribe handler
	// will block (via svcOnce) until initialisation finishes.
	initService := func() {
		svcOnce.Do(func() {
			svc, svcErr = bootstrap.NewTranscriptionServiceFromEnv()
			if svcErr != nil {
				log.Printf("Service initialization failed: %v", svcErr)
			}
		})
	}
	go initService()

	mux := http.NewServeMux()

	mux.Handle("/api/transcribe", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Block until background init completes (no-op on subsequent calls).
		initService()
		if svcErr != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("service initialization failed: %v", svcErr)})
			return
		}
		api.NewTranscribeHandler(svc).ServeHTTP(w, r)
	}))

	mux.HandleFunc("/debug/env", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		keys := []string{
			"WHISPER_MODEL_PATH", "UPLOAD_BLOB_API_URL", "UPLOAD_BLOB_API_TOKEN",
			"POSTGRES_URL", "INFISICAL_ENABLED", "PORT",
		}
		result := map[string]interface{}{}
		for _, k := range keys {
			result[k] = os.Getenv(k) != ""
		}
		_ = json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/debug/db", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		postgresURL := os.Getenv("POSTGRES_URL")
		result := map[string]interface{}{"postgres_url_set": postgresURL != ""}
		if postgresURL == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			result["error"] = "POSTGRES_URL not set"
			_ = json.NewEncoder(w).Encode(result)
			return
		}
		ctx := r.Context()
		repo, err := repository.NewPostgresMediaItemRepository(ctx, postgresURL)
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			result["error"] = fmt.Sprintf("connect failed: %v", err)
			_ = json.NewEncoder(w).Encode(result)
			return
		}
		defer repo.Close(ctx)
		items, err := repo.FetchAll(ctx)
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			result["error"] = fmt.Sprintf("query failed: %v", err)
			_ = json.NewEncoder(w).Encode(result)
			return
		}
		result["ok"] = true
		result["media_items_count"] = len(items)
		_ = json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(healthResponse{
			Name:   "yt-transcribe",
			Status: "ok",
		}); err != nil {
			http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
		}
	})

	log.Printf("Starting HTTP server on :%s", port)
	handleFatalError("HTTP server stopped", http.ListenAndServe(":"+port, mux))
}

// runFromCLI processes a single URL provided via flags or positional args.
func runFromCLI(ctx context.Context, svc src.TranscriptionService, videoURL, outputDir string) {
	if videoURL == "" {
		if len(flag.Args()) > 0 {
			videoURL = flag.Args()[0]
		} else {
			log.Printf("No URL provided. Using default URL: %s", DEFAULT_VIDEO_URL)
			videoURL = DEFAULT_VIDEO_URL
		}
	}

	if _, err := url.ParseRequestURI(videoURL); err != nil {
		handleFatalError(fmt.Sprintf("Error: Invalid video URL provided: %s", videoURL), err)
	}

	fmt.Printf("Transcribing video from URL: %s\n", videoURL)
	fmt.Printf("Output directory: %s\n", outputDir)

	if _, err := svc.Execute(ctx, videoURL, outputDir); err != nil {
		handleFatalError("Error executing transcription service", err)
	}
}

// runFromDB fetches and processes unprocessed media_items rows until no more
// eligible items are found in the database.
func runFromDB(ctx context.Context, svc src.TranscriptionService, outputDir string) {
	cfg, err := bootstrap.LoadConfigFromEnv(ctx)
	if err != nil {
		handleFatalError("Failed to load configuration", err)
	}

	postgresURL := cfg.PostgresURL
	if postgresURL == "" {
		handleFatalError("POSTGRES_URL not set (required for -db mode)", nil)
	}

	repo, err := repository.NewPostgresMediaItemRepository(ctx, postgresURL)
	if err != nil {
		handleFatalError("Failed to connect to database", err)
	}
	defer repo.Close(ctx)

	retryPath := retryStatePath()

	for {
		state, err := loadRetryState(retryPath)
		if err != nil {
			log.Printf("Warning: failed to load retry state from %s: %v", retryPath, err)
			state = &retryState{Items: map[string]retryEntry{}}
		}

		now := time.Now()
		blockedIDs := state.blockedIDs(now)

		item, err := repo.FetchNextUnprocessed(ctx, blockedIDs)
		if err != nil {
			handleFatalError("Failed to fetch next unprocessed item", err)
		}

		if item == nil {
			if nextRetry, ok := state.earliestNextAttempt(now); ok {
				msg := fmt.Sprintf("No more eligible items are ready yet. Next retry after %s.", nextRetry.Format(time.RFC3339))
				fmt.Println(msg)
				reportJobStatus("idle", msg)
			} else {
				reportJobStatus("idle", "No unprocessed items found in the database. Nothing to do.")
				fmt.Println("No unprocessed items found in the database. Nothing to do.")
			}
			return
		}

		fmt.Printf("\n--- Processing next item ---\n")
		fmt.Printf("id: %s  platform: %s  url: %s\n", item.ID, item.Platform, item.URL)

		blobURL, err := svc.Execute(ctx, item.URL, outputDir)
		if err != nil {
			entry := state.recordFailure(item.ID, err, time.Now())
			if saveErr := saveRetryState(retryPath, state); saveErr != nil {
				log.Printf("Warning: failed to save retry state: %v", saveErr)
			}

			isPermanent := IsPermanentError(err.Error())
			if isPermanent {
				msg := fmt.Sprintf("Transcription skipped for id %s (permanent error); item blocked indefinitely: %v", item.ID, err)
				log.Println(msg)
				reportJobStatus("idle", msg)
			} else {
				msg := fmt.Sprintf("Transcription failed for id %s; retry scheduled for %s: %v", item.ID, entry.NextAttempt.Format(time.RFC3339), err)
				log.Println(msg)
				reportJobStatus("error", msg)
			}
			// Continue to next item even if one fails
			continue
		}

		if err := repo.UpdateTranscriptURL(ctx, item.ID, blobURL); err != nil {
			entry := state.recordFailure(item.ID, err, time.Now())
			if saveErr := saveRetryState(retryPath, state); saveErr != nil {
				log.Printf("Warning: failed to save retry state: %v", saveErr)
			}
			msg := fmt.Sprintf("Transcription succeeded but db update failed for id %s; retry scheduled for %s: %v", item.ID, entry.NextAttempt.Format(time.RFC3339), err)
			log.Println(msg)
			reportJobStatus("error", msg)
			continue
		}

		state.clear(item.ID)
		if err := saveRetryState(retryPath, state); err != nil {
			log.Printf("Warning: failed to clear retry state: %v", err)
		}

		msg := fmt.Sprintf("transcript_url updated in database for id %s → %s", item.ID, blobURL)
		fmt.Println(msg)
		reportJobStatus("success", msg)
	}
}

// runReprocessAll fetches every record in media_items and re-transcribes each one,
// overwriting the existing transcript_url. Failures on individual items are logged
// and skipped so the rest of the batch can continue.
func runReprocessAll(ctx context.Context, svc src.TranscriptionService, outputDir string) {
	cfg, err := bootstrap.LoadConfigFromEnv(ctx)
	if err != nil {
		handleFatalError("Failed to load configuration", err)
	}

	postgresURL := cfg.PostgresURL
	if postgresURL == "" {
		handleFatalError("POSTGRES_URL not set (required for -reprocess-all mode)", nil)
	}

	repo, err := repository.NewPostgresMediaItemRepository(ctx, postgresURL)
	if err != nil {
		handleFatalError("Failed to connect to database", err)
	}
	defer repo.Close(ctx)

	items, err := repo.FetchAll(ctx)
	if err != nil {
		handleFatalError("Failed to fetch all items from database", err)
	}
	if len(items) == 0 {
		fmt.Println("No records found in the database. Nothing to do.")
		return
	}

	total := len(items)
	succeeded, failed := 0, 0

	fmt.Printf("Reprocessing %d record(s)...\n\n", total)

	for i, item := range items {
		fmt.Printf("[%d/%d] id: %s  platform: %s  url: %s\n", i+1, total, item.ID, item.Platform, item.URL)

		blobURL, err := svc.Execute(ctx, item.URL, outputDir)
		if err != nil {
			log.Printf("  ✗ transcription failed: %v — skipping\n", err)
			failed++
			continue
		}

		if err := repo.UpdateTranscriptURL(ctx, item.ID, blobURL); err != nil {
			log.Printf("  ✗ db update failed: %v — skipping\n", err)
			failed++
			continue
		}

		fmt.Printf("  ✓ transcript_url updated\n")
		succeeded++
	}

	fmt.Printf("\nDone. %d succeeded, %d failed out of %d total.\n", succeeded, failed, total)
}
