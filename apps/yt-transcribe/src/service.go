package src

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
)

const (
	APP_NAME           = "yt-transcribe"
	PLATFORM_OTHER     = "other"
	PLATFORM_YOUTUBE   = "youtube"
	PLATFORM_INSTAGRAM = "instagram"
)

// vercelBlobResponse represents the JSON response from the Vercel Blob API.
type vercelBlobResponse struct {
	URL                string `json:"url"`
	Pathname           string `json:"pathname"`
	ContentType        string `json:"contentType"`
	ContentDisposition string `json:"contentDisposition"`
}

// TranscriptionServiceImpl is the implementation of the TranscriptionService interface.
type TranscriptionServiceImpl struct {
	Downloader  VideoDownloader
	Transcriber Transcriber
	Uploader    Uploader
}

// NewTranscriptionService creates a new TranscriptionServiceImpl.
func NewTranscriptionService(downloader VideoDownloader, transcriber Transcriber, uploader Uploader) TranscriptionService {
	return &TranscriptionServiceImpl{
		Downloader:  downloader,
		Transcriber: transcriber,
		Uploader:    uploader,
	}
}

// Execute orchestrates the download, transcription, and upload processes.
// It returns the Vercel Blob URL of the uploaded transcript.
func (s *TranscriptionServiceImpl) Execute(ctx context.Context, videoURL, outputDir string) (string, error) {
	// 1. Download the audio
	fmt.Println("Downloading audio...")
	audioFilePath, videoID, err := s.Downloader.DownloadAudio(ctx, videoURL, outputDir)
	if err != nil {
		return "", fmt.Errorf("error downloading audio: %w", err)
	}
	fmt.Printf("Audio downloaded to: %s\n", audioFilePath)
	defer func() {
		if err := os.Remove(audioFilePath); err != nil {
			log.Printf("Warning: could not remove temporary audio file %s: %v", audioFilePath, err)
		}
		fmt.Printf("Removed temporary audio file: %s\n", audioFilePath)
	}()

	// 2. Transcribe the audio
	fmt.Println("Transcribing audio...")
	transcription, err := s.Transcriber.Transcribe(ctx, audioFilePath)
	if err != nil {
		return "", fmt.Errorf("error transcribing audio: %w", err)
	}

	// 3. Determine platform for upload path
	platform := PLATFORM_OTHER
	if strings.Contains(videoURL, "youtube.com") || strings.Contains(videoURL, "youtu.be/") {
		platform = PLATFORM_YOUTUBE
	} else if strings.Contains(videoURL, "instagram.com") {
		platform = PLATFORM_INSTAGRAM
	}

	// 4. Upload the transcription
	fmt.Println("Uploading transcription...")
	uploadPath := fmt.Sprintf("%s/%s/%s", APP_NAME, platform, videoID)
	rawResponse, err := s.Uploader.Upload(ctx, transcription, uploadPath)
	if err != nil {
		return "", fmt.Errorf("error uploading transcription: %w", err)
	}

	fmt.Println("\n--- Transcription Upload Complete ---")
	var blobResp vercelBlobResponse
	if jsonErr := json.Unmarshal([]byte(rawResponse), &blobResp); jsonErr == nil {
		fmt.Printf("Blob URL:  %s\n", blobResp.URL)
		fmt.Printf("Pathname:  %s\n", blobResp.Pathname)
		return blobResp.URL, nil
	}

	fmt.Println(rawResponse)
	return rawResponse, nil
}
