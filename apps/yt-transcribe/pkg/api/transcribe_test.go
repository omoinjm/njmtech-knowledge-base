package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

type stubTranscriptionService struct {
	executeFunc func(ctx context.Context, videoURL, outputDir string) (string, error)
}

func (s *stubTranscriptionService) Execute(ctx context.Context, videoURL, outputDir string) (string, error) {
	if s.executeFunc != nil {
		return s.executeFunc(ctx, videoURL, outputDir)
	}

	return "", nil
}

func TestTranscribeHandler_MethodNotAllowed(t *testing.T) {
	handler := NewTranscribeHandler(&stubTranscriptionService{})
	req := httptest.NewRequest(http.MethodGet, "/api/transcribe", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, recorder.Code)
	}

	if allow := recorder.Header().Get("Allow"); allow != http.MethodPost {
		t.Fatalf("expected Allow header %q, got %q", http.MethodPost, allow)
	}
}

func TestTranscribeHandler_InvalidJSON(t *testing.T) {
	handler := NewTranscribeHandler(&stubTranscriptionService{})
	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{"url":`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
}

func TestTranscribeHandler_MissingURL(t *testing.T) {
	handler := NewTranscribeHandler(&stubTranscriptionService{})
	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
}

func TestTranscribeHandler_InvalidURL(t *testing.T) {
	handler := NewTranscribeHandler(&stubTranscriptionService{})
	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{"url":"not-a-url"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
}

func TestTranscribeHandler_ServiceNotConfigured(t *testing.T) {
	handler := NewTranscribeHandler(nil)
	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{"url":"https://example.com/watch?v=123"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, recorder.Code)
	}
}

func TestTranscribeHandler_ExecuteFailure(t *testing.T) {
	handler := NewTranscribeHandler(&stubTranscriptionService{
		executeFunc: func(ctx context.Context, videoURL, outputDir string) (string, error) {
			return "", errors.New("boom")
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{"url":"https://example.com/watch?v=123"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, recorder.Code)
	}
}

func TestTranscribeHandler_Success(t *testing.T) {
	var (
		receivedURL       string
		receivedOutputDir string
	)

	handler := NewTranscribeHandler(&stubTranscriptionService{
		executeFunc: func(ctx context.Context, videoURL, outputDir string) (string, error) {
			receivedURL = videoURL
			receivedOutputDir = outputDir

			if outputDir == "" {
				t.Fatal("expected outputDir to be set")
			}

			if info, err := os.Stat(outputDir); err != nil {
				t.Fatalf("expected temp output directory to exist: %v", err)
			} else if !info.IsDir() {
				t.Fatal("expected outputDir to be a directory")
			}

			return "https://blob.example.com/transcript.srt", nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader(`{"url":"https://example.com/watch?v=123"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", contentType)
	}

	if receivedURL != "https://example.com/watch?v=123" {
		t.Fatalf("expected url to be forwarded to service, got %q", receivedURL)
	}

	var response transcribeResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("expected valid JSON response: %v", err)
	}

	if response.BlobURL != "https://blob.example.com/transcript.srt" {
		t.Fatalf("expected blobUrl in response, got %q", response.BlobURL)
	}

	if _, err := os.Stat(receivedOutputDir); !os.IsNotExist(err) {
		t.Fatalf("expected temp output directory to be removed, got err=%v", err)
	}
}
