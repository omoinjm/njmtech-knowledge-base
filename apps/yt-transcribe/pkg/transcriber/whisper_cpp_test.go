package transcriber

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestNewWhisperCPPTranscriber ensures the constructor works correctly.
func TestNewWhisperCPPTranscriber(t *testing.T) {
	modelPath := "/path/to/model"
	transcriber := NewWhisperCPPTranscriber(modelPath, 2, []string{"--translate"})
	if transcriber == nil {
		t.Errorf("NewWhisperCPPTranscriber returned nil")
	}
	if transcriber.ModelPath != modelPath {
		t.Errorf("Expected ModelPath to be '%s', but got '%s'", modelPath, transcriber.ModelPath)
	}
	if transcriber.Threads != 2 {
		t.Errorf("Expected Threads to be 2, but got %d", transcriber.Threads)
	}
}

func TestTranscribe_WhisperCLINotFound(t *testing.T) {
	oldLookPath := execLookPath
	oldCommand := execCommand
	t.Cleanup(func() {
		execLookPath = oldLookPath
		execCommand = oldCommand
	})

	execLookPath = func(file string) (string, error) {
		if file == "whisper-cli" {
			return "", errors.New("not found")
		}
		return oldLookPath(file)
	}

	transcriber := NewWhisperCPPTranscriber("/path/to/model", 1, nil)
	_, err := transcriber.Transcribe(context.Background(), "/path/to/audio.wav")

	if err == nil {
		t.Fatal("expected an error but got nil")
	}
	if !strings.Contains(err.Error(), "whisper-cli not found") {
		t.Errorf("expected error to contain 'whisper-cli not found', but got: %v", err)
	}
}

func TestTranscribe_Success(t *testing.T) {
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
		cs := []string{"-test.run=TestHelperProcess", "--"}
		cs = append(cs, args...)
		cmd := oldCommand(ctx, os.Args[0], cs...)
		cmd.Env = []string{"GO_WANT_HELPER_PROCESS=1"}
		return cmd
	}

	modelPath := writeTestModelFile(t, t.TempDir(), "ggml-test.bin")
	transcriber := NewWhisperCPPTranscriber(modelPath, 1, nil)
	transcript, err := transcriber.Transcribe(context.Background(), "/path/to/audio.wav")

	if err != nil {
		t.Fatalf("expected no error, but got: %v", err)
	}

	expectedTranscript := "This is a test transcript."
	if transcript != expectedTranscript {
		t.Errorf("expected transcript to be '%s', but got '%s'", expectedTranscript, transcript)
	}
}

// TestHelperProcess isn't a real test. It's used as a helper for other tests.
func TestHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}

	args := os.Args
	for i, arg := range args {
		if arg == "--" {
			args = args[i+1:]
			break
		}
	}

	var outputFile string
	for i, arg := range args {
		if arg == "--output-file" && i+1 < len(args) {
			outputFile = args[i+1]
			break
		}
	}

	if outputFile == "" {
		os.Exit(1)
	}

	file, err := os.Create(outputFile + ".srt")
	if err != nil {
		os.Exit(1)
	}
	defer file.Close()
	file.WriteString("This is a test transcript.")
	os.Exit(0)
}

func TestTranscribe_CommandFailed(t *testing.T) {
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
		cmd := oldCommand(ctx, os.Args[0], "-test.run=TestHelperProcessFailed")
		cmd.Env = []string{"GO_WANT_HELPER_PROCESS_FAILED=1"}
		return cmd
	}

	modelPath := writeTestModelFile(t, t.TempDir(), "ggml-test.bin")
	transcriber := NewWhisperCPPTranscriber(modelPath, 1, nil)
	_, err := transcriber.Transcribe(context.Background(), "/path/to/audio.wav")

	if err == nil {
		t.Fatal("expected an error but got nil")
	}
	if !strings.Contains(err.Error(), "failed to execute whisper-cli") {
		t.Errorf("expected error to contain 'failed to execute whisper-cli', but got: %v", err)
	}
}

func TestTranscribe_FallbackModelWhenContextInitFails(t *testing.T) {
	oldLookPath := execLookPath
	oldCommand := execCommand
	oldBundledModelsDir := bundledModelsDir
	oldFallbackModels := bundledFallbackModels
	t.Cleanup(func() {
		execLookPath = oldLookPath
		execCommand = oldCommand
		bundledModelsDir = oldBundledModelsDir
		bundledFallbackModels = oldFallbackModels
	})

	bundledModelsDir = t.TempDir()
	bundledFallbackModels = []string{"ggml-base.en.bin"}
	fallbackModelPath := writeTestModelFile(t, bundledModelsDir, "ggml-base.en.bin")

	execLookPath = func(file string) (string, error) {
		return "/path/to/" + file, nil
	}
	execCommand = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		cs := []string{"-test.run=TestHelperProcessContextInitFallback", "--"}
		cs = append(cs, args...)
		cmd := oldCommand(ctx, os.Args[0], cs...)
		cmd.Env = []string{"GO_WANT_HELPER_PROCESS_CONTEXT_FALLBACK=1"}
		return cmd
	}

	primaryModelPath := writeTestModelFile(t, t.TempDir(), "ggml-invalid.bin")
	transcriber := NewWhisperCPPTranscriber(primaryModelPath, 1, nil)
	transcript, err := transcriber.Transcribe(context.Background(), "/path/to/audio.wav")

	if err != nil {
		t.Fatalf("expected no error, but got: %v", err)
	}
	if transcript != "This is a fallback transcript." {
		t.Fatalf("expected fallback transcript, got %q", transcript)
	}
	if _, err := os.Stat(fallbackModelPath); err != nil {
		t.Fatalf("expected fallback model to exist, got: %v", err)
	}
}

func TestResolveModelPath_UsesConfiguredPath(t *testing.T) {
	modelPath := writeTestModelFile(t, t.TempDir(), "ggml-test.bin")

	resolvedPath, err := ResolveModelPath(modelPath)
	if err != nil {
		t.Fatalf("expected no error, but got: %v", err)
	}
	if resolvedPath != modelPath {
		t.Fatalf("expected resolved path %q, got %q", modelPath, resolvedPath)
	}
}

func TestResolveModelPath_FallsBackToBundledModelWithSameFilename(t *testing.T) {
	oldBundledModelsDir := bundledModelsDir
	bundledModelsDir = t.TempDir()
	t.Cleanup(func() {
		bundledModelsDir = oldBundledModelsDir
	})

	modelPath := writeTestModelFile(t, bundledModelsDir, "ggml-base.en.bin")
	resolvedPath, err := ResolveModelPath("/host/models/ggml-base.en.bin")
	if err != nil {
		t.Fatalf("expected no error, but got: %v", err)
	}
	if resolvedPath != modelPath {
		t.Fatalf("expected resolved path %q, got %q", modelPath, resolvedPath)
	}
}

func TestResolveModelPath_ReturnsHelpfulErrorWhenModelMissing(t *testing.T) {
	oldBundledModelsDir := bundledModelsDir
	bundledModelsDir = t.TempDir()
	t.Cleanup(func() {
		bundledModelsDir = oldBundledModelsDir
	})

	_, err := ResolveModelPath("/host/models/ggml-missing.bin")
	if err == nil {
		t.Fatal("expected an error but got nil")
	}
	if !strings.Contains(err.Error(), "configured path") {
		t.Fatalf("expected error to mention configured path, got: %v", err)
	}
}

func writeTestModelFile(t *testing.T, dir, name string) string {
	t.Helper()

	modelPath := filepath.Join(dir, name)
	if err := os.WriteFile(modelPath, []byte("test model"), 0o600); err != nil {
		t.Fatalf("failed to create test model file: %v", err)
	}

	return modelPath
}

func TestHelperProcessFailed(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS_FAILED") != "1" {
		return
	}
	os.Exit(1)
}

func TestHelperProcessContextInitFallback(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS_CONTEXT_FALLBACK") != "1" {
		return
	}

	args := os.Args
	for i, arg := range args {
		if arg == "--" {
			args = args[i+1:]
			break
		}
	}

	var modelPath string
	var outputFile string
	for i, arg := range args {
		if arg == "-m" && i+1 < len(args) {
			modelPath = args[i+1]
		}
		if arg == "--output-file" && i+1 < len(args) {
			outputFile = args[i+1]
		}
	}

	if strings.Contains(modelPath, "ggml-invalid.bin") {
		os.Stderr.WriteString("error: failed to initialize whisper context\n")
		os.Exit(3)
	}

	file, err := os.Create(outputFile + ".srt")
	if err != nil {
		os.Exit(1)
	}
	defer file.Close()
	file.WriteString("This is a fallback transcript.")
	os.Exit(0)
}
