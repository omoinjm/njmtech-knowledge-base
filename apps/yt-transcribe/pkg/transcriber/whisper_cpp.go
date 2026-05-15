package transcriber

import (
	"context"
	"errors"
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
	bundledModelsDir = "/whisper.cpp/models"
)

var bundledFallbackModels = []string{
	"ggml-base.en.bin",
	"ggml-tiny.en.bin",
}

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

// ResolveModelPath returns a usable Whisper model path.
// If the configured path does not exist, it falls back to a bundled model with the same basename.
func ResolveModelPath(modelPath string) (string, error) {
	if modelPath == "" {
		return "", fmt.Errorf("WHISPER_MODEL_PATH not set")
	}

	if info, err := os.Stat(modelPath); err == nil && !info.IsDir() {
		return modelPath, nil
	}

	modelName := filepath.Base(modelPath)
	if modelName == "" || modelName == "." || modelName == string(filepath.Separator) {
		return "", fmt.Errorf("whisper model not found: invalid path %q", modelPath)
	}

	bundledPath := filepath.Join(bundledModelsDir, modelName)
	if info, err := os.Stat(bundledPath); err == nil && !info.IsDir() {
		return bundledPath, nil
	}

	return "", fmt.Errorf(
		"whisper model not found: configured path %q does not exist and no bundled model named %q was found under %q",
		modelPath,
		modelName,
		bundledModelsDir,
	)
}

// Transcribe transcribes the given audio file using whisper.cpp.
func (t *WhisperCPPTranscriber) Transcribe(ctx context.Context, audioFilePath string) (string, error) {
	// Check if whisper-cli is available
	if _, err := execLookPath("whisper-cli"); err != nil {
		return "", fmt.Errorf("whisper-cli not found in PATH: %w", err)
	}

	modelPath, err := ResolveModelPath(t.ModelPath)
	if err != nil {
		return "", err
	}
	modelCandidates := buildModelCandidates(modelPath)

	// Create a temporary directory for output files
	tmpDir, err := os.MkdirTemp("", "whisper-transcript-")
	if err != nil {
		return "", fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer os.RemoveAll(tmpDir) // Clean up the temporary directory

	outputPrefix := filepath.Join(tmpDir, "transcript")
	outputFilePath := outputPrefix + ".srt" // whisper-cli adds .srt extension

	var runErrs []error
	for _, candidateModelPath := range modelCandidates {
		// Construct the command
		cmdArgs := []string{
			"-m", candidateModelPath,
			"-f", audioFilePath,
			"--output-srt",
			"--output-file", outputPrefix,
			"--no-prints",
			"-t", strconv.Itoa(t.Threads),
		}
		cmdArgs = append(cmdArgs, t.ExtraArgs...)

		cmd := execCommand(ctx, "whisper-cli", cmdArgs...)

		// Execute the command
		output, runErr := cmd.CombinedOutput()
		if runErr == nil {
			// Read the transcribed text from the output file
			transcriptBytes, err := os.ReadFile(outputFilePath)
			if err != nil {
				return "", fmt.Errorf("failed to read transcript file %s: %w", outputFilePath, err)
			}
			return string(transcriptBytes), nil
		}

		runErrs = append(runErrs, fmt.Errorf("model %q failed: %w\nOutput: %s", candidateModelPath, runErr, output))
		if !strings.Contains(string(output), "failed to initialize whisper context") {
			break
		}
	}
	return "", fmt.Errorf("failed to execute whisper-cli: %w", errors.Join(runErrs...))
}

// ParseWhisperExtraArgs splits a shell-style arg string into whitespace-delimited args.
// It intentionally keeps parsing simple for env var use (no quote handling).
func ParseWhisperExtraArgs(raw string) []string {
	if raw == "" {
		return nil
	}
	return strings.Fields(raw)
}

func buildModelCandidates(primaryModelPath string) []string {
	candidates := []string{primaryModelPath}
	seen := map[string]struct{}{
		primaryModelPath: {},
	}

	for _, modelName := range bundledFallbackModels {
		path := filepath.Join(bundledModelsDir, modelName)
		if _, ok := seen[path]; ok {
			continue
		}
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			candidates = append(candidates, path)
			seen[path] = struct{}{}
		}
	}

	return candidates
}
