package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

type transcriptionExecutor interface {
	Execute(ctx context.Context, videoURL, outputDir string) (blobURL string, err error)
}

type TranscribeHandler struct {
	service transcriptionExecutor
}

type transcribeRequest struct {
	URL string `json:"url"`
}

type transcribeResponse struct {
	BlobURL string `json:"blobUrl"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func NewTranscribeHandler(service transcriptionExecutor) *TranscribeHandler {
	return &TranscribeHandler{service: service}
}

func (h *TranscribeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	if h.service == nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "transcription service is not configured"})
		return
	}

	var request transcribeRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body: only a single JSON object is allowed"})
		return
	}

	request.URL = strings.TrimSpace(request.URL)
	if request.URL == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "url is required"})
		return
	}

	if _, err := url.ParseRequestURI(request.URL); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: fmt.Sprintf("invalid url: %v", err)})
		return
	}

	outputDir, err := os.MkdirTemp(os.TempDir(), "yt-transcribe-api-")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: fmt.Sprintf("failed to create temporary output directory: %v", err)})
		return
	}
	defer os.RemoveAll(outputDir)

	blobURL, err := h.service.Execute(r.Context(), request.URL, outputDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: fmt.Sprintf("transcription failed: %v", err)})
		return
	}

	writeJSON(w, http.StatusOK, transcribeResponse{BlobURL: blobURL})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
	}
}
