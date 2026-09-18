package transcriber

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// HTTPClient allows net/http.Client to be swapped out in tests.
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

const (
	// DefaultCloudflareAIModel is used when no model is configured.
	DefaultCloudflareAIModel = "@cf/openai/whisper-large-v3-turbo"

	// defaultChunkSeconds keeps each request comfortably under Workers AI's
	// per-request memory/execution-time limits for the Whisper models.
	// Cloudflare's own docs recommend chunking long audio rather than
	// sending a whole file in one request:
	// https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/
	defaultChunkSeconds = 300

	cloudflareAIRunURLFormat = "https://api.cloudflare.com/client/v4/accounts/%s/ai/run/%s"
)

// CloudflareAITranscriber implements the Transcriber interface (the "v2"
// backend) using Cloudflare Workers AI's hosted Whisper models instead of a
// local whisper.cpp binary. Long audio is split into fixed-length chunks
// with ffmpeg before each chunk is sent to Workers AI; per-chunk segment
// timestamps are then offset by the chunk's start time and stitched into one
// continuous SRT file, since Workers AI has no single-request endpoint for
// arbitrarily long audio.
type CloudflareAITranscriber struct {
	AccountID    string
	APIToken     string
	Model        string
	ChunkSeconds int

	httpClient HTTPClient
}

// NewCloudflareAITranscriber creates a new CloudflareAITranscriber.
// chunkSeconds <= 0 falls back to defaultChunkSeconds; client == nil falls
// back to a plain *http.Client with a generous timeout (each request holds a
// base64-encoded audio chunk and can take a while to transcribe).
func NewCloudflareAITranscriber(accountID, apiToken, model string, chunkSeconds int, client HTTPClient) *CloudflareAITranscriber {
	if model == "" {
		model = DefaultCloudflareAIModel
	}
	if chunkSeconds <= 0 {
		chunkSeconds = defaultChunkSeconds
	}
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Minute}
	}
	return &CloudflareAITranscriber{
		AccountID:    accountID,
		APIToken:     apiToken,
		Model:        model,
		ChunkSeconds: chunkSeconds,
		httpClient:   client,
	}
}

type cloudflareAISegment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

type cloudflareAIResult struct {
	Text     string                `json:"text"`
	Segments []cloudflareAISegment `json:"segments"`
}

type cloudflareAIResponse struct {
	Result  cloudflareAIResult `json:"result"`
	Success bool               `json:"success"`
	Errors  []struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"errors"`
}

// Transcribe transcribes the given audio file using Cloudflare Workers AI.
func (t *CloudflareAITranscriber) Transcribe(ctx context.Context, audioFilePath string) (string, error) {
	if t.AccountID == "" || t.APIToken == "" {
		return "", fmt.Errorf("cloudflare AI transcriber requires an account ID and an API token")
	}

	chunkPaths, tmpDir, err := splitAudioIntoChunks(ctx, audioFilePath, t.ChunkSeconds)
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	var allSegments []cloudflareAISegment
	for i, chunkPath := range chunkPaths {
		// ffmpeg's segment muxer produces fixed-length chunks (the final one
		// may be shorter), so the start offset of chunk i is always
		// i * ChunkSeconds regardless of how long earlier chunks actually
		// ran — no need to probe each chunk's real duration.
		offset := float64(i) * float64(t.ChunkSeconds)

		result, err := t.transcribeChunk(ctx, chunkPath)
		if err != nil {
			return "", fmt.Errorf("failed to transcribe chunk %d/%d: %w", i+1, len(chunkPaths), err)
		}

		for _, seg := range result.Segments {
			allSegments = append(allSegments, cloudflareAISegment{
				Start: seg.Start + offset,
				End:   seg.End + offset,
				Text:  seg.Text,
			})
		}
	}

	return segmentsToSRT(allSegments), nil
}

func (t *CloudflareAITranscriber) transcribeChunk(ctx context.Context, chunkPath string) (*cloudflareAIResult, error) {
	audioBytes, err := os.ReadFile(chunkPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read chunk file: %w", err)
	}

	reqBody, err := json.Marshal(map[string]string{
		"audio": base64.StdEncoding.EncodeToString(audioBytes),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	runURL := fmt.Sprintf(cloudflareAIRunURLFormat, t.AccountID, t.Model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, runURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+t.APIToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var data cloudflareAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response (status %d): %w", resp.StatusCode, err)
	}

	if resp.StatusCode != http.StatusOK || !data.Success {
		message := fmt.Sprintf("HTTP %d", resp.StatusCode)
		if len(data.Errors) > 0 {
			parts := make([]string, len(data.Errors))
			for i, e := range data.Errors {
				parts[i] = e.Message
			}
			message = strings.Join(parts, "; ")
		}
		return nil, fmt.Errorf("workers AI request failed: %s", message)
	}

	return &data.Result, nil
}

// splitAudioIntoChunks uses ffmpeg's segment muxer to split audioFilePath
// into fixed-length WAV chunks under a fresh temp directory, which the
// caller is responsible for removing. Chunks are returned in playback order.
func splitAudioIntoChunks(ctx context.Context, audioFilePath string, chunkSeconds int) (chunkPaths []string, tmpDir string, err error) {
	if _, err := execLookPath("ffmpeg"); err != nil {
		return nil, "", fmt.Errorf("ffmpeg not found in PATH: %w", err)
	}

	tmpDir, err = os.MkdirTemp("", "cf-ai-transcribe-chunks-")
	if err != nil {
		return nil, "", fmt.Errorf("failed to create temporary directory: %w", err)
	}

	outputPattern := filepath.Join(tmpDir, "chunk_%04d.wav")
	cmd := execCommand(ctx, "ffmpeg",
		"-i", audioFilePath,
		"-f", "segment",
		"-segment_time", strconv.Itoa(chunkSeconds),
		"-ar", "16000",
		"-ac", "1",
		"-c:a", "pcm_s16le",
		"-reset_timestamps", "1",
		outputPattern,
	)

	output, runErr := cmd.CombinedOutput()
	if runErr != nil {
		os.RemoveAll(tmpDir)
		return nil, "", fmt.Errorf("ffmpeg chunking failed: %w\nOutput: %s", runErr, output)
	}

	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		os.RemoveAll(tmpDir)
		return nil, "", fmt.Errorf("failed to read chunk directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			chunkPaths = append(chunkPaths, filepath.Join(tmpDir, entry.Name()))
		}
	}
	sort.Strings(chunkPaths)

	if len(chunkPaths) == 0 {
		os.RemoveAll(tmpDir)
		return nil, "", fmt.Errorf("ffmpeg produced no audio chunks for %q", audioFilePath)
	}

	return chunkPaths, tmpDir, nil
}

// segmentsToSRT renders Whisper segments as an SRT file, renumbering cues
// sequentially from 1.
func segmentsToSRT(segments []cloudflareAISegment) string {
	var b strings.Builder
	cueNumber := 1
	for _, seg := range segments {
		text := strings.TrimSpace(seg.Text)
		if text == "" {
			continue
		}
		fmt.Fprintf(&b, "%d\n%s --> %s\n%s\n\n",
			cueNumber,
			formatSRTTimestamp(seg.Start),
			formatSRTTimestamp(seg.End),
			text,
		)
		cueNumber++
	}
	return b.String()
}

// formatSRTTimestamp renders a duration in seconds as an SRT timestamp
// (HH:MM:SS,mmm).
func formatSRTTimestamp(seconds float64) string {
	if seconds < 0 {
		seconds = 0
	}
	totalMillis := int64(math.Round(seconds * 1000))

	hours := totalMillis / 3_600_000
	totalMillis %= 3_600_000
	minutes := totalMillis / 60_000
	totalMillis %= 60_000
	secs := totalMillis / 1_000
	millis := totalMillis % 1_000

	return fmt.Sprintf("%02d:%02d:%02d,%03d", hours, minutes, secs, millis)
}
