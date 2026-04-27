package downloader

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestNewYTDLPAudioDownloader ensures the constructor works correctly.
func TestNewYTDLPAudioDownloader(t *testing.T) {
	downloader := NewYTDLPAudioDownloader("", "")
	if downloader == nil {
		t.Errorf("NewYTDLPAudioDownloader returned nil, expected an instance")
	}
}

// TestDownloadAudio_FFMPEGNotFound tests the scenario where ffmpeg is not found.
func TestDownloadAudio_FFMPEGNotFound(t *testing.T) {
	old := osLookPath
	t.Cleanup(func() { osLookPath = old })
	osLookPath = func(file string) (string, error) {
		if file == "ffmpeg" {
			return "", errors.New("not found in PATH")
		}
		return "/usr/local/bin/yt-dlp", nil
	}

	downloader := NewYTDLPAudioDownloader("", "")
	_, _, err := downloader.DownloadAudio(context.Background(), "https://youtube.com/watch?v=test", os.TempDir())
	if err == nil {
		t.Error("Expected an error when ffmpeg is not found, but got none")
	}
	if !strings.Contains(err.Error(), "ffmpeg not found") {
		t.Errorf("Expected 'ffmpeg not found' error, got: %v", err)
	}
}

// TestDownloadAudio_YTDLPNotFound tests the scenario where yt-dlp is not found.
func TestDownloadAudio_YTDLPNotFound(t *testing.T) {
	old := osLookPath
	t.Cleanup(func() { osLookPath = old })
	osLookPath = func(file string) (string, error) {
		if file == "ffmpeg" {
			return "/usr/local/bin/ffmpeg", nil
		}
		if file == "yt-dlp" {
			return "", errors.New("not found in PATH")
		}
		return "", nil
	}

	downloader := NewYTDLPAudioDownloader("", "")
	_, _, err := downloader.DownloadAudio(context.Background(), "https://youtube.com/watch?v=test", os.TempDir())
	if err == nil {
		t.Error("Expected an error when yt-dlp is not found, but got none")
	}
	if !strings.Contains(err.Error(), "yt-dlp not found") {
		t.Errorf("Expected 'yt-dlp not found' error, got: %v", err)
	}
}

// TestDownloadAudio_Success tests a successful download scenario.
func TestDownloadAudio_Success(t *testing.T) {
	oldCommandExecutor := commandExecutor
	oldOsLookPath := osLookPath
	oldOsStat := osStat
	oldCmdCombinedOutput := cmdCombinedOutput
	t.Cleanup(func() {
		commandExecutor = oldCommandExecutor
		osLookPath = oldOsLookPath
		osStat = oldOsStat
		cmdCombinedOutput = oldCmdCombinedOutput
	})

	osLookPath = func(file string) (string, error) {
		return "/usr/local/bin/" + file, nil
	}

	tempDir := t.TempDir()
	expectedVideoID := "test-video-id"
	expectedFilename := fmt.Sprintf("%s.wav", expectedVideoID)
	expectedFilePath := filepath.Join(tempDir, expectedFilename)
	dummyFileContent := []byte("dummy audio content")

	commandExecutor = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return &exec.Cmd{
			Path: name,
			Args: append([]string{name}, args...),
		}
	}
	cmdCombinedOutput = func(cmd *exec.Cmd) ([]byte, error) {
		if strings.Contains(cmd.String(), "--get-id") {
			return []byte(expectedVideoID), nil
		}
		err := os.WriteFile(expectedFilePath, dummyFileContent, 0644)
		if err != nil {
			return nil, fmt.Errorf("mock failed to create dummy file: %w", err)
		}
		return []byte("yt-dlp success"), nil
	}
	osStat = func(name string) (os.FileInfo, error) {
		return os.Stat(name)
	}

	downloader := NewYTDLPAudioDownloader("", "")
	downloadedPath, videoID, err := downloader.DownloadAudio(context.Background(), "https://youtube.com/watch?v=test", tempDir)

	if err != nil {
		t.Fatalf("DownloadAudio failed unexpectedly: %v", err)
	}
	if downloadedPath != expectedFilePath {
		t.Errorf("Downloaded path mismatch. Expected: %s, Got: %s", expectedFilePath, downloadedPath)
	}
	if videoID != expectedVideoID {
		t.Errorf("Video ID mismatch. Expected: %s, Got: %s", expectedVideoID, videoID)
	}

	if _, err = os.Stat(downloadedPath); os.IsNotExist(err) {
		t.Errorf("Downloaded file %s does not exist", downloadedPath)
	}
}

// TestDownloadAudio_CommandFailed tests when yt-dlp command returns an error.
func TestDownloadAudio_CommandFailed(t *testing.T) {
	oldCommandExecutor := commandExecutor
	oldOsLookPath := osLookPath
	oldOsStat := osStat
	oldCmdCombinedOutput := cmdCombinedOutput
	t.Cleanup(func() {
		commandExecutor = oldCommandExecutor
		osLookPath = oldOsLookPath
		osStat = oldOsStat
		cmdCombinedOutput = oldCmdCombinedOutput
	})

	osLookPath = func(file string) (string, error) {
		if file == "ffmpeg" {
			return "/usr/local/bin/ffmpeg", nil
		}
		if file == "yt-dlp" {
			return "/usr/local/bin/yt-dlp", nil
		}
		return "", nil
	}
	osStat = func(name string) (os.FileInfo, error) { return nil, os.ErrNotExist }

	expectedErrorMsg := "yt-dlp error output"
	commandExecutor = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return &exec.Cmd{
			Path: name,
			Args: append([]string{name}, args...),
		}
	}
	cmdCombinedOutput = func(cmd *exec.Cmd) ([]byte, error) {
		return []byte("Error output from yt-dlp: " + expectedErrorMsg), errors.New("exit status 1")
	}

	downloader := NewYTDLPAudioDownloader("", "")
	_, _, err := downloader.DownloadAudio(context.Background(), "https://youtube.com/watch?v=test", os.TempDir())

	if err == nil {
		t.Error("Expected an error from failed yt-dlp command, but got none")
	}
	if !strings.Contains(err.Error(), "failed") {
		t.Errorf("Expected 'failed' error with specific message, got: %v", err)
	}
}

// TestDownloadAudio_WithCookies tests if cookies are correctly passed to yt-dlp.
func TestDownloadAudio_WithCookies(t *testing.T) {
	oldCommandExecutor := commandExecutor
	oldOsLookPath := osLookPath
	oldCmdCombinedOutput := cmdCombinedOutput
	t.Cleanup(func() {
		commandExecutor = oldCommandExecutor
		osLookPath = oldOsLookPath
		cmdCombinedOutput = oldCmdCombinedOutput
	})

	osLookPath = func(file string) (string, error) {
		return "/usr/local/bin/" + file, nil
	}

	cookiesFile := "cookies.txt"
	cookiesFromBrowser := "chrome"
	
	commandExecutor = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		argStr := strings.Join(args, " ")
		if !strings.Contains(argStr, "--cookies "+cookiesFile) {
			t.Errorf("Expected --cookies %s in command, but not found. Args: %v", cookiesFile, args)
		}
		if !strings.Contains(argStr, "--cookies-from-browser "+cookiesFromBrowser) {
			t.Errorf("Expected --cookies-from-browser %s in command, but not found. Args: %v", cookiesFromBrowser, args)
		}
		return &exec.Cmd{
			Path: name,
			Args: append([]string{name}, args...),
		}
	}
	
	cmdCombinedOutput = func(cmd *exec.Cmd) ([]byte, error) {
		return []byte("test-video-id"), nil
	}

	downloader := NewYTDLPAudioDownloader(cookiesFile, cookiesFromBrowser)
	// We only care about the command construction, so we can ignore the rest of DownloadAudio for this test
	// by making it fail after the first command if we wanted, but here we just want to see if commandExecutor is called correctly.
	downloader.DownloadAudio(context.Background(), "https://youtube.com/watch?v=test", t.TempDir())
}
