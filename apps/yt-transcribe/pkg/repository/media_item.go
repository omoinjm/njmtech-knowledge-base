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
	// Returns nil, nil when there are no unprocessed items.
	FetchNextUnprocessed(ctx context.Context) (*MediaItem, error)

	// FetchAll returns every row in media_items ordered by created_at ASC.
	// Used by the reprocess-all mode to regenerate transcripts for existing records.
	FetchAll(ctx context.Context) ([]MediaItem, error)

	// UpdateTranscriptURL writes the Vercel Blob URL back to transcript_url for the given row id.
	UpdateTranscriptURL(ctx context.Context, id, transcriptURL string) error
}
