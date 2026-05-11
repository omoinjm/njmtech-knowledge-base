package repository

import "context"

// MediaItem represents an unprocessed row from the media_items table.
// Only the fields needed by the transcription pipeline are mapped here.
type MediaItem struct {
	ID       string
	URL      string
	Platform string
	VideoID  string
}

// MediaItemRepository defines the database operations needed by the transcription pipeline.
type MediaItemRepository interface {
	// FetchNextUnprocessed returns the oldest media_items row whose transcript_url is NULL.
	// Rows whose IDs appear in excludedIDs are skipped.
	// Returns nil, nil when there are no eligible unprocessed items.
	FetchNextUnprocessed(ctx context.Context, excludedIDs []string) (*MediaItem, error)

	// FetchAll returns every row in media_items ordered by created_at ASC.
	// Used by the reprocess-all mode to regenerate transcripts for existing records.
	FetchAll(ctx context.Context) ([]MediaItem, error)

	// UpdateTranscriptURL writes the transcript URL back to transcript_url for the given row id.
	UpdateTranscriptURL(ctx context.Context, id, transcriptURL string) error

	// RecordRetryFailure stores failure metadata and the next attempt time for an item.
	RecordRetryFailure(ctx context.Context, id, errMsg string) (nextAttempt string, isPermanent bool, err error)

	// ClearRetryFailure removes any retry metadata for an item after successful processing.
	ClearRetryFailure(ctx context.Context, id string) error

	// EarliestRetryAfter returns the earliest future retry timestamp, RFC3339 formatted.
	// When no blocked retries exist, the second return value is false.
	EarliestRetryAfter(ctx context.Context) (string, bool, error)
}
