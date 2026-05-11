package transcriber

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

var (
	execLookPath = exec.LookPath
	execCommand  = exec.CommandContext
)

// WhisperCPPTranscriber implements the Transcriber interface using whisper.cpp.
type WhisperCPPTranscriber struct {
	ModelPath string
	Threads   int
	ExtraArgs []string
}

// NewWhisperCPPTranscriber creates a new WhisperCPPTranscriber.
func NewWhisperCPPTranscriber(modelPath string, threads int, extraArgs []string) *WhisperCPPTranscriber {
	if threads <= 0 {
		threads = 1
	}
	return &WhisperCPPTranscriber{
		ModelPath: modelPath,
		Threads:   threads,
		ExtraArgs: extraArgs,
	}
}

// Transcribe transcribes the given audio file using whisper.cpp.
func (t *WhisperCPPTranscriber) Transcribe(ctx context.Context, audioFilePath string) (string, error) {
	// Check if whisper-cli is available
	if _, err := execLookPath("whisper-cli"); err != nil {
		return "", fmt.Errorf("whisper-cli not found in PATH: %w", err)
	}

	// Create a temporary directory for output files
	tmpDir, err := os.MkdirTemp("", "whisper-transcript-")
	if err != nil {
		return "", fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer os.RemoveAll(tmpDir) // Clean up the temporary directory

	outputPrefix := filepath.Join(tmpDir, "transcript")
	outputFilePath := outputPrefix + ".srt" // whisper-cli adds .srt extension

	// Construct the command
	cmdArgs := []string{
		"-m", t.ModelPath,
		"-f", audioFilePath,
		"--output-srt",
		"--output-file", outputPrefix,
		"--no-prints",
		"-t", strconv.Itoa(t.Threads),
	}
	cmdArgs = append(cmdArgs, t.ExtraArgs...)

	cmd := execCommand(ctx, "whisper-cli", cmdArgs...)

	// Execute the command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to execute whisper-cli: %w\nOutput: %s", err, output)
	}

	// Read the transcribed text from the output file
	transcriptBytes, err := os.ReadFile(outputFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to read transcript file %s: %w", outputFilePath, err)
	}

	return string(transcriptBytes), nil
}

// ParseWhisperExtraArgs splits a shell-style arg string into whitespace-delimited args.
// It intentionally keeps parsing simple for env var use (no quote handling).
func ParseWhisperExtraArgs(raw string) []string {
	if raw == "" {
		return nil
	}
	return strings.Fields(raw)
}
