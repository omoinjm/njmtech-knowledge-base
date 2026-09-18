package transcriber

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// MockHTTPClient is a mock for HTTPClient for granular control over responses.
type MockHTTPClient struct {
	DoFunc func(req *http.Request) (*http.Response, error)
}

func (m *MockHTTPClient) Do(req *http.Request) (*http.Response, error) {
	if m.DoFunc != nil {
		return m.DoFunc(req)
	}
	return nil, fmt.Errorf("DoFunc not set")
}

func TestNewCloudflareAITranscriber_Defaults(t *testing.T) {
	tr := NewCloudflareAITranscriber("acct", "token", "", 0, nil)
	if tr.Model != DefaultCloudflareAIModel {
		t.Errorf("expected default model %q, got %q", DefaultCloudflareAIModel, tr.Model)
	}
	if tr.ChunkSeconds != defaultChunkSeconds {
		t.Errorf("expected default chunk seconds %d, got %d", defaultChunkSeconds, tr.ChunkSeconds)
	}
	if tr.httpClient == nil {
		t.Error("expected a default httpClient, got nil")
	}
}

func TestNewCloudflareAITranscriber_CustomValues(t *testing.T) {
	mockClient := &MockHTTPClient{}
	tr := NewCloudflareAITranscriber("acct", "token", "@cf/openai/whisper", 60, mockClient)
	if tr.Model != "@cf/openai/whisper" {
		t.Errorf("expected custom model, got %q", tr.Model)
	}
	if tr.ChunkSeconds != 60 {
		t.Errorf("expected custom chunk seconds 60, got %d", tr.ChunkSeconds)
	}
	if tr.httpClient != mockClient {
		t.Error("expected the provided httpClient to be used")
	}
}

func TestCloudflareAITranscribe_MissingCredentials(t *testing.T) {
	tr := NewCloudflareAITranscriber("", "", "", 0, &MockHTTPClient{})
	_, err := tr.Transcribe(context.Background(), "/path/to/audio.wav")
	if err == nil || !strings.Contains(err.Error(), "requires an account ID and an API token") {
		t.Fatalf("expected missing-credentials error, got: %v", err)
	}
}

func TestCloudflareAITranscribe_FFmpegNotFound(t *testing.T) {
	oldLookPath := execLookPath
	t.Cleanup(func() { execLookPath = oldLookPath })

	execLookPath = func(file string) (string, error) {
		if file == "ffmpeg" {
			return "", fmt.Errorf("not found")
		}
		return oldLookPath(file)
	}

	tr := NewCloudflareAITranscriber("acct", "token", "", 0, &MockHTTPClient{})
	_, err := tr.Transcribe(context.Background(), "/path/to/audio.wav")
	if err == nil || !strings.Contains(err.Error(), "ffmpeg not found") {
		t.Fatalf("expected ffmpeg-not-found error, got: %v", err)
	}
}

// fakeFFmpegChunker replaces execCommand with a helper process that writes
// `chunkCount` placeholder .wav files matching the "chunk_%04d.wav" pattern
// ffmpeg would normally produce, without needing a real ffmpeg binary.
func fakeFFmpegChunker(t *testing.T, chunkCount int) {
	t.Helper()
	oldLookPath := execLookPath
	oldCommand := execCommand
	t.Cleanup(func() {
		execLookPath = oldLookPath
		execCommand = oldCommand
	})

	execLookPath = func(file string) (string, error) {
		return "/path/to/" + file, nil
	}
	execCommand = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		cs := []string{"-test.run=TestHelperProcessFFmpegChunk", "--"}
		cs = append(cs, strconv.Itoa(chunkCount))
		cs = append(cs, args...)
		cmd := oldCommand(ctx, os.Args[0], cs...)
		cmd.Env = []string{"GO_WANT_HELPER_PROCESS_FFMPEG_CHUNK=1"}
		return cmd
	}
}

// TestHelperProcessFFmpegChunk isn't a real test. It stands in for ffmpeg:
// it reads the desired chunk count and the output pattern (the last CLI
// arg) and writes that many numbered placeholder files.
func TestHelperProcessFFmpegChunk(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS_FFMPEG_CHUNK") != "1" {
		return
	}

	args := os.Args
	for i, arg := range args {
		if arg == "--" {
			args = args[i+1:]
			break
		}
	}
	if len(args) < 2 {
		os.Exit(1)
	}

	chunkCount, err := strconv.Atoi(args[0])
	if err != nil {
		os.Exit(1)
	}
	outputPattern := args[len(args)-1]

	for i := 0; i < chunkCount; i++ {
		path := fmt.Sprintf(outputPattern, i)
		if err := os.WriteFile(path, []byte("fake-audio-chunk"), 0o600); err != nil {
			os.Exit(1)
		}
	}
	os.Exit(0)
}

func TestCloudflareAITranscribe_Success(t *testing.T) {
	fakeFFmpegChunker(t, 2)

	var requestCount int
	mockClient := &MockHTTPClient{
		DoFunc: func(req *http.Request) (*http.Response, error) {
			requestCount++
			if got := req.Header.Get("Authorization"); got != "Bearer test-token" {
				t.Errorf("expected Authorization 'Bearer test-token', got %q", got)
			}
			if got := req.URL.String(); !strings.Contains(got, "/accounts/test-acct/ai/run/") {
				t.Errorf("expected URL to target the configured account, got %q", got)
			}

			var reqBody map[string]string
			if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
				t.Fatalf("failed to decode request body: %v", err)
			}
			if reqBody["audio"] == "" {
				t.Error("expected base64-encoded audio field to be set")
			}

			// Second chunk's segments should be offset relative to the first.
			text := fmt.Sprintf("chunk %d text", requestCount)
			body := cloudflareAIResponse{
				Success: true,
				Result: cloudflareAIResult{
					Text: text,
					Segments: []cloudflareAISegment{
						{Start: 0, End: 2.5, Text: text},
					},
				},
			}
			payload, _ := json.Marshal(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		},
	}

	tr := NewCloudflareAITranscriber("test-acct", "test-token", "", 10, mockClient)
	srt, err := tr.Transcribe(context.Background(), "/path/to/audio.wav")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("expected 2 chunk requests, got %d", requestCount)
	}

	expected := "1\n00:00:00,000 --> 00:00:02,500\nchunk 1 text\n\n" +
		"2\n00:00:10,000 --> 00:00:12,500\nchunk 2 text\n\n"
	if srt != expected {
		t.Fatalf("expected SRT:\n%q\ngot:\n%q", expected, srt)
	}
}

func TestCloudflareAITranscribe_APIError(t *testing.T) {
	fakeFFmpegChunker(t, 1)

	mockClient := &MockHTTPClient{
		DoFunc: func(req *http.Request) (*http.Response, error) {
			body := cloudflareAIResponse{
				Success: false,
				Errors: []struct {
					Code    int    `json:"code"`
					Message string `json:"message"`
				}{{Code: 5007, Message: "audio too long"}},
			}
			payload, _ := json.Marshal(body)
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		},
	}

	tr := NewCloudflareAITranscriber("test-acct", "test-token", "", 10, mockClient)
	_, err := tr.Transcribe(context.Background(), "/path/to/audio.wav")
	if err == nil || !strings.Contains(err.Error(), "audio too long") {
		t.Fatalf("expected error containing API message, got: %v", err)
	}
}

func TestCloudflareAITranscribe_NoChunksProduced(t *testing.T) {
	fakeFFmpegChunker(t, 0)

	tr := NewCloudflareAITranscriber("test-acct", "test-token", "", 10, &MockHTTPClient{})
	_, err := tr.Transcribe(context.Background(), "/path/to/audio.wav")
	if err == nil || !strings.Contains(err.Error(), "no audio chunks") {
		t.Fatalf("expected no-chunks error, got: %v", err)
	}
}

func TestSegmentsToSRT_SkipsEmptyText(t *testing.T) {
	segments := []cloudflareAISegment{
		{Start: 0, End: 1, Text: "  "},
		{Start: 1, End: 2, Text: "kept"},
	}
	srt := segmentsToSRT(segments)
	expected := "1\n00:00:01,000 --> 00:00:02,000\nkept\n\n"
	if srt != expected {
		t.Fatalf("expected %q, got %q", expected, srt)
	}
}

func TestFormatSRTTimestamp(t *testing.T) {
	cases := map[float64]string{
		0:        "00:00:00,000",
		1.5:      "00:00:01,500",
		61.25:    "00:01:01,250",
		3661.001: "01:01:01,001",
		-5:       "00:00:00,000",
	}
	for input, expected := range cases {
		if got := formatSRTTimestamp(input); got != expected {
			t.Errorf("formatSRTTimestamp(%v) = %q, want %q", input, got, expected)
		}
	}
}

func TestSplitAudioIntoChunks_CleansUpOnFFmpegFailure(t *testing.T) {
	oldLookPath := execLookPath
	oldCommand := execCommand
	t.Cleanup(func() {
		execLookPath = oldLookPath
		execCommand = oldCommand
	})

	execLookPath = func(file string) (string, error) { return "/path/to/" + file, nil }
	execCommand = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		cmd := oldCommand(ctx, os.Args[0], "-test.run=TestHelperProcessFailed")
		cmd.Env = []string{"GO_WANT_HELPER_PROCESS_FAILED=1"}
		return cmd
	}

	_, tmpDir, err := splitAudioIntoChunks(context.Background(), "/path/to/audio.wav", 10)
	if err == nil {
		t.Fatal("expected an error but got nil")
	}
	if tmpDir != "" {
		if _, statErr := os.Stat(tmpDir); statErr == nil {
			t.Fatalf("expected temp dir %q to be cleaned up on failure", tmpDir)
		}
	}
}

func TestSplitAudioIntoChunks_SortsChunkPaths(t *testing.T) {
	fakeFFmpegChunker(t, 12) // exercise lexicographic-vs-numeric ordering past 9

	paths, tmpDir, err := splitAudioIntoChunks(context.Background(), "/path/to/audio.wav", 10)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	if len(paths) != 12 {
		t.Fatalf("expected 12 chunk paths, got %d", len(paths))
	}
	for i, p := range paths {
		expectedName := fmt.Sprintf("chunk_%04d.wav", i)
		if filepath.Base(p) != expectedName {
			t.Errorf("expected chunk %d to be %q, got %q", i, expectedName, filepath.Base(p))
		}
	}
}
