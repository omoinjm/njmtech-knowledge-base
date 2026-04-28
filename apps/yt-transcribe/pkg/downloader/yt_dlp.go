package downloader

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// execCommandFunc is a type that allows us to mock exec.CommandContext in tests.
type execCommandFunc func(ctx context.Context, name string, arg ...string) *exec.Cmd

var commandExecutor execCommandFunc = exec.CommandContext

// osLookPath is a variable that can be overridden for testing purposes.
var osLookPath = exec.LookPath

// osStat is a variable that can be overridden for testing purposes.
var osStat = os.Stat

// cmdCombinedOutput is a variable that can be overridden for testing purposes.
var cmdCombinedOutput = func(cmd *exec.Cmd) ([]byte, error) {
	return cmd.CombinedOutput()
}

// YTDLPAudioDownloader is an implementation of VideoDownloader that uses the `yt-dlp` external tool.
// It downloads the audio stream of a given video.
type YTDLPAudioDownloader struct {
	cookiesFile        string
	cookiesFromBrowser string
}

// NewYTDLPAudioDownloader creates and returns a new instance of YTDLPAudioDownloader.
// This acts as a constructor, promoting consistency in object creation.
func NewYTDLPAudioDownloader(cookiesFile, cookiesFromBrowser string) *YTDLPAudioDownloader {
	return &YTDLPAudioDownloader{
		cookiesFile:        cookiesFile,
		cookiesFromBrowser: cookiesFromBrowser,
	}
}

// DownloadAudio downloads the audio stream from the specified video URL
// and saves it to the given output directory.
// It returns the full path to the downloaded audio file and the video ID, or an error if the download fails.
//
// Dependencies: This function relies on the `yt-dlp` command-line tool being installed
// and accessible in the system's PATH.
//
// Example yt-dlp command:
// yt-dlp -x --audio-format wav --output "/path/to/output/videoID.wav" <video-url>
func (d *YTDLPAudioDownloader) DownloadAudio(ctx context.Context, videoURL string, outputDir string) (string, string, error) {
	// Check if ffmpeg is installed
	if _, err := osLookPath("ffmpeg"); err != nil {
		return "", "", fmt.Errorf("ffmpeg not found in PATH. ffmpeg is required by yt-dlp to process audio. Please install it to use this feature: %w", err)
	}

	// Check if yt-dlp is installed
	if _, err := osLookPath("yt-dlp"); err != nil {
		return "", "", fmt.Errorf("yt-dlp not found in PATH. Please install it to use this feature: %w", err)
	}

	// Build common arguments
	commonArgs := []string{}
	jsRuntimes := os.Getenv("YT_DLP_JS_RUNTIMES")
	if jsRuntimes == "" {
		// Default to node in headless/container environments where YouTube may require JS execution.
		jsRuntimes = "node"
	}
	commonArgs = append(commonArgs, "--js-runtimes", jsRuntimes)
	if d.cookiesFile != "" {
		commonArgs = append(commonArgs, "--cookies", d.cookiesFile)
	}
	if d.cookiesFromBrowser != "" {
		commonArgs = append(commonArgs, "--cookies-from-browser", d.cookiesFromBrowser)
	}

	// Get video ID
	idArgs := append(commonArgs, "--get-id", videoURL)
	idCmd := commandExecutor(ctx, "yt-dlp", idArgs...)
	idOutput, err := cmdCombinedOutput(idCmd)
	if err != nil {
		return "", "", fmt.Errorf("failed to get video ID: %v\nOutput: %s", err, string(idOutput))
	}

	lines := strings.Split(string(idOutput), "\n")
	var videoID string
	for i := len(lines) - 1; i >= 0; i-- {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed != "" {
			videoID = trimmed
			break
		}
	}

	if videoID == "" {
		return "", "", fmt.Errorf("could not extract video ID from yt-dlp output: %s", string(idOutput))
	}

	// Generate filename based on video ID
	outputFilename := fmt.Sprintf("%s.wav", videoID)
	downloadedFilePath := filepath.Join(outputDir, outputFilename)

	downloadArgs := append(commonArgs,
		"-x",                    // Extract audio
		"--audio-format", "wav", // Convert audio to wav format
		"--output", downloadedFilePath, // Output path
		"--restrict-filenames", // Keep filenames simple
		videoURL,
	)
	cmd := commandExecutor(ctx, "yt-dlp", downloadArgs...)

	fmt.Printf("Executing command: %s\n", cmd.String())

	output, err := cmdCombinedOutput(cmd)
	if err != nil {
		if _, statErr := osStat(downloadedFilePath); os.IsNotExist(statErr) {
			return "", "", fmt.Errorf("yt-dlp command failed: %v\nOutput: %s", err, string(output))
		}
	}

	// Verify the file exists
	if _, err := osStat(downloadedFilePath); os.IsNotExist(err) {
		return "", "", fmt.Errorf("yt-dlp reported successful download, but file not found at expected path: %s", downloadedFilePath)
	}

	return downloadedFilePath, videoID, nil
}
