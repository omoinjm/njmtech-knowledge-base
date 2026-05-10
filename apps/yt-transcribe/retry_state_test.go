package main

import (
	"testing"
	"time"
)

func TestIsPermanentError(t *testing.T) {
	tests := []struct {
		errMsg string
		want   bool
	}{
		{"Video unavailable. This video is restricted.", true},
		{"This video is private", true},
		{"Video has been removed by the uploader", true},
		{"The following content is not available on this app", true},
		{"Sign in to confirm your age", true},
		{"connection reset by peer", false},
		{"timeout awaiting response headers", false},
		{"403 Forbidden", false}, // 403 can be transient (IP-based)
		{"429 Too Many Requests", false},
	}

	for _, tt := range tests {
		if got := IsPermanentError(tt.errMsg); got != tt.want {
			t.Errorf("IsPermanentError(%q) = %v, want %v", tt.errMsg, got, tt.want)
		}
	}
}

func TestRetryDelay(t *testing.T) {
	const permanentDelay = 10 * 365 * 24 * time.Hour

	tests := []struct {
		errMsg   string
		failures int
		want     time.Duration
	}{
		{"Video unavailable", 1, permanentDelay},
		{"Video unavailable", 5, permanentDelay},
		{"connection reset", 1, 15 * time.Minute},
		{"403 forbidden", 1, 6 * time.Hour},
		{"random error", 1, 15 * time.Minute},
		{"random error", 2, 30 * time.Minute},
		{"random error", 3, 1 * time.Hour},
	}

	for _, tt := range tests {
		got := retryDelay(tt.errMsg, tt.failures)
		if got != tt.want {
			t.Errorf("retryDelay(%q, %d) = %v, want %v", tt.errMsg, tt.failures, got, tt.want)
		}
	}
}
