
package src

import "context"

// VideoDownloader defines the interface for downloading audio from videos.
// Applying the Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP).
type VideoDownloader interface {
	DownloadAudio(ctx context.Context, videoURL string, outputDir string) (filePath string, videoID string, err error)
}

// Transcriber defines the interface for transcribing audio files into text.
// This adheres to the Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP).
type Transcriber interface {
	Transcribe(ctx context.Context, audioFilePath string) (string, error)
}

// Uploader defines the interface for uploading content.
type Uploader interface {
	Upload(ctx context.Context, content string, filename string) (string, error)
}

// TranscriptionService defines the interface for the main transcription service.
type TranscriptionService interface {
	// Execute orchestrates download → transcribe → upload and returns the uploaded blob URL.
	Execute(ctx context.Context, videoURL, outputDir string) (blobURL string, err error)
}
