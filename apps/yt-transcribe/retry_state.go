package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultRetryStateFile = "/tmp/yt-transcribe-retry-state.json"

type retryEntry struct {
	Failures    int       `json:"failures"`
	NextAttempt time.Time `json:"next_attempt"`
	LastError   string    `json:"last_error"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type retryState struct {
	Items map[string]retryEntry `json:"items"`
}

func loadRetryState(path string) (*retryState, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &retryState{Items: map[string]retryEntry{}}, nil
		}
		return nil, fmt.Errorf("failed to read retry state: %w", err)
	}

	var state retryState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to parse retry state: %w", err)
	}
	if state.Items == nil {
		state.Items = map[string]retryEntry{}
	}
	return &state, nil
}

func saveRetryState(path string, state *retryState) error {
	if state == nil {
		return fmt.Errorf("retry state is nil")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("failed to create retry state directory: %w", err)
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode retry state: %w", err)
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o600); err != nil {
		return fmt.Errorf("failed to write retry state temp file: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("failed to replace retry state file: %w", err)
	}
	return nil
}

func (s *retryState) blockedIDs(now time.Time) []string {
	if s == nil || len(s.Items) == 0 {
		return nil
	}

	ids := make([]string, 0, len(s.Items))
	for id, entry := range s.Items {
		if entry.NextAttempt.After(now) {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *retryState) earliestNextAttempt(now time.Time) (time.Time, bool) {
	if s == nil || len(s.Items) == 0 {
		return time.Time{}, false
	}

	var earliest time.Time
	found := false
	for _, entry := range s.Items {
		if !entry.NextAttempt.After(now) {
			continue
		}
		if !found || entry.NextAttempt.Before(earliest) {
			earliest = entry.NextAttempt
			found = true
		}
	}
	return earliest, found
}

func (s *retryState) recordFailure(id string, err error, now time.Time) retryEntry {
	if s.Items == nil {
		s.Items = map[string]retryEntry{}
	}

	existing := s.Items[id]
	existing.Failures++
	existing.LastError = err.Error()
	existing.UpdatedAt = now
	existing.NextAttempt = now.Add(retryDelay(err.Error(), existing.Failures))
	s.Items[id] = existing
	return existing
}

func (s *retryState) clear(id string) {
	if s == nil || s.Items == nil {
		return
	}
	delete(s.Items, id)
}

func retryDelay(errMsg string, failures int) time.Duration {
	lower := strings.ToLower(errMsg)

	if IsPermanentError(errMsg) {
		// 10 years is effectively "forever" for this system's lifecycle.
		return 10 * 365 * 24 * time.Hour
	}

	base := 15 * time.Minute
	if strings.Contains(lower, "403") || strings.Contains(lower, "429") || strings.Contains(lower, "forbidden") || strings.Contains(lower, "too many requests") {
		base = 6 * time.Hour
	} else if strings.Contains(lower, "timeout") || strings.Contains(lower, "temporary") || strings.Contains(lower, "connection reset") || strings.Contains(lower, "eof") {
		base = 15 * time.Minute
	}

	if failures <= 1 {
		if base > 24*time.Hour {
			return 24 * time.Hour
		}
		return base
	}

	delay := base << min(failures-1, 4)
	if delay > 24*time.Hour {
		delay = 24 * time.Hour
	}
	return delay
}

// IsPermanentError returns true if the error message indicates a failure that
// is unlikely to be resolved by retrying (e.g. video removed, restricted, or private).
func IsPermanentError(errMsg string) bool {
	lower := strings.ToLower(errMsg)
	permanentPhrases := []string{
		"video unavailable",
		"is restricted",
		"is private",
		"has been removed",
		"not available in your country",
		"not available on this app",
		"confirm your age",
		"requires a subscription",
		"account has been terminated",
		"no longer available",
	}

	for _, phrase := range permanentPhrases {
		if strings.Contains(lower, phrase) {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
