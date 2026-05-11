package repository

import (
	"strings"
	"time"
)

func retryDelay(errMsg string, failures int) time.Duration {
	lower := strings.ToLower(errMsg)

	if IsPermanentError(errMsg) {
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
