package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// d1Client runs SQL statements against a Cloudflare D1 database via its REST
// API. yt-transcribe runs as a plain Go binary/container, not a Cloudflare
// Worker, so it has no native D1 binding and talks to D1 over HTTPS instead
// (the same approach apps/media/src/lib/d1.ts uses).
type d1Client struct {
	accountID  string
	databaseID string
	apiToken   string
	httpClient *http.Client
}

type d1QueryResult struct {
	Results []map[string]interface{} `json:"results"`
	Success bool                     `json:"success"`
}

type d1ApiResponse struct {
	Result  []d1QueryResult `json:"result"`
	Success bool            `json:"success"`
	Errors  []struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"errors"`
}

func (c *d1Client) execute(ctx context.Context, sqlText string, params []interface{}) ([]map[string]interface{}, error) {
	if params == nil {
		params = []interface{}{}
	}

	reqBody, err := json.Marshal(map[string]interface{}{"sql": sqlText, "params": params})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal D1 request: %w", err)
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query", c.accountID, c.databaseID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to build D1 request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("D1 request failed: %w", err)
	}
	defer resp.Body.Close()

	var data d1ApiResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode D1 response (status %d): %w", resp.StatusCode, err)
	}

	if resp.StatusCode != http.StatusOK || !data.Success {
		message := fmt.Sprintf("HTTP %d", resp.StatusCode)
		if len(data.Errors) > 0 {
			parts := make([]string, len(data.Errors))
			for i, e := range data.Errors {
				parts[i] = e.Message
			}
			message = strings.Join(parts, "; ")
		}
		return nil, fmt.Errorf("D1 query failed: %s\nSQL: %s", message, sqlText)
	}

	if len(data.Result) == 0 {
		return nil, nil
	}
	return data.Result[0].Results, nil
}

// D1MediaItemRepository implements MediaItemRepository against the
// njmtech-media Cloudflare D1 database.
type D1MediaItemRepository struct {
	client *d1Client
}

// NewD1MediaItemRepository creates a repository backed by the D1 REST API
// and ensures the media_item_retry_state table exists.
func NewD1MediaItemRepository(ctx context.Context, accountID, databaseID, apiToken string) (*D1MediaItemRepository, error) {
	repo := &D1MediaItemRepository{
		client: &d1Client{
			accountID:  accountID,
			databaseID: databaseID,
			apiToken:   apiToken,
			httpClient: &http.Client{Timeout: 30 * time.Second},
		},
	}
	if err := repo.ensureRetryTable(ctx); err != nil {
		return nil, err
	}
	return repo, nil
}

// Close is a no-op: the D1 REST client holds no persistent connection.
func (r *D1MediaItemRepository) Close(_ context.Context) error {
	return nil
}

func (r *D1MediaItemRepository) ensureRetryTable(ctx context.Context) error {
	const stmt = `
		CREATE TABLE IF NOT EXISTS media_item_retry_state (
			media_item_id TEXT PRIMARY KEY,
			failures INTEGER NOT NULL DEFAULT 0,
			next_attempt TEXT NOT NULL,
			last_error TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`
	if _, err := r.client.execute(ctx, stmt, nil); err != nil {
		return fmt.Errorf("failed to ensure media_item_retry_state table: %w", err)
	}
	return nil
}

// FetchNextUnprocessed returns the oldest unclaimed row. D1 serializes every
// write to a single underlying SQLite file, and this job only ever runs as a
// single instance, so there is no concurrent-worker race to guard against —
// unlike the Postgres version, no FOR UPDATE SKIP LOCKED equivalent is needed.
func (r *D1MediaItemRepository) FetchNextUnprocessed(ctx context.Context, excludedIDs []string) (*MediaItem, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	params := []interface{}{now}

	query := `
		SELECT id, url, platform, video_id
		FROM   media_items
		WHERE  transcript_url IS NULL
		AND    NOT EXISTS (
			SELECT 1
			FROM media_item_retry_state rs
			WHERE rs.media_item_id = media_items.id
			AND rs.next_attempt > ?
		)`

	if len(excludedIDs) > 0 {
		placeholders := make([]string, len(excludedIDs))
		for i, id := range excludedIDs {
			placeholders[i] = "?"
			params = append(params, id)
		}
		query += fmt.Sprintf(" AND id NOT IN (%s)", strings.Join(placeholders, ", "))
	}

	query += " ORDER BY created_at ASC LIMIT 1"

	rows, err := r.client.execute(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch next unprocessed item: %w", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rowToMediaItem(rows[0]), nil
}

// FetchAll returns every row in media_items ordered by created_at ASC.
func (r *D1MediaItemRepository) FetchAll(ctx context.Context) ([]MediaItem, error) {
	const query = `SELECT id, url, platform, video_id FROM media_items ORDER BY created_at ASC`

	rows, err := r.client.execute(ctx, query, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch all items: %w", err)
	}

	items := make([]MediaItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, *rowToMediaItem(row))
	}
	return items, nil
}

// UpdateTranscriptURL sets transcript_url for the row identified by id.
func (r *D1MediaItemRepository) UpdateTranscriptURL(ctx context.Context, id, transcriptURL string) error {
	const query = `UPDATE media_items SET transcript_url = ? WHERE id = ? RETURNING id`

	rows, err := r.client.execute(ctx, query, []interface{}{transcriptURL, id})
	if err != nil {
		return fmt.Errorf("failed to update transcript_url for id %s: %w", id, err)
	}
	if len(rows) == 0 {
		return fmt.Errorf("no row found with id %s", id)
	}
	return nil
}

func (r *D1MediaItemRepository) RecordRetryFailure(ctx context.Context, id, errMsg string) (string, bool, error) {
	const selectStmt = `SELECT failures FROM media_item_retry_state WHERE media_item_id = ?`
	rows, err := r.client.execute(ctx, selectStmt, []interface{}{id})
	if err != nil {
		return "", false, fmt.Errorf("failed to read retry-state row for id %s: %w", id, err)
	}

	failures := 0
	if len(rows) > 0 {
		failures = int(toFloat(rows[0]["failures"]))
	}
	failures++

	isPermanent := IsPermanentError(errMsg)
	nextAttempt := time.Now().Add(retryDelay(errMsg, failures)).UTC()
	now := time.Now().UTC().Format(time.RFC3339)

	const upsertStmt = `
		INSERT INTO media_item_retry_state (media_item_id, failures, next_attempt, last_error, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (media_item_id)
		DO UPDATE SET
			failures = excluded.failures,
			next_attempt = excluded.next_attempt,
			last_error = excluded.last_error,
			updated_at = excluded.updated_at`
	if _, err := r.client.execute(ctx, upsertStmt, []interface{}{
		id, failures, nextAttempt.Format(time.RFC3339), errMsg, now,
	}); err != nil {
		return "", false, fmt.Errorf("failed to upsert retry-state row for id %s: %w", id, err)
	}

	return nextAttempt.Format(time.RFC3339), isPermanent, nil
}

func (r *D1MediaItemRepository) ClearRetryFailure(ctx context.Context, id string) error {
	const stmt = `DELETE FROM media_item_retry_state WHERE media_item_id = ?`
	if _, err := r.client.execute(ctx, stmt, []interface{}{id}); err != nil {
		return fmt.Errorf("failed to clear retry-state row for id %s: %w", id, err)
	}
	return nil
}

func (r *D1MediaItemRepository) EarliestRetryAfter(ctx context.Context) (string, bool, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	const stmt = `SELECT MIN(next_attempt) AS next_attempt FROM media_item_retry_state WHERE next_attempt > ?`

	rows, err := r.client.execute(ctx, stmt, []interface{}{now})
	if err != nil {
		return "", false, fmt.Errorf("failed to query earliest retry attempt: %w", err)
	}
	if len(rows) == 0 || rows[0]["next_attempt"] == nil {
		return "", false, nil
	}
	return toString(rows[0]["next_attempt"]), true, nil
}

func (r *D1MediaItemRepository) GetRetryState(ctx context.Context, id string) (*RetryStateInfo, error) {
	const stmt = `
		SELECT media_item_id, failures, next_attempt, last_error, updated_at
		FROM media_item_retry_state
		WHERE media_item_id = ?`

	rows, err := r.client.execute(ctx, stmt, []interface{}{id})
	if err != nil {
		return nil, fmt.Errorf("failed to query retry-state row for id %s: %w", id, err)
	}
	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	return &RetryStateInfo{
		MediaItemID: toString(row["media_item_id"]),
		Failures:    int(toFloat(row["failures"])),
		NextAttempt: toString(row["next_attempt"]),
		LastError:   toString(row["last_error"]),
		UpdatedAt:   toString(row["updated_at"]),
	}, nil
}

func rowToMediaItem(row map[string]interface{}) *MediaItem {
	return &MediaItem{
		ID:       toString(row["id"]),
		URL:      toString(row["url"]),
		Platform: toString(row["platform"]),
		VideoID:  toString(row["video_id"]),
	}
}

// toString coerces a decoded D1 JSON value (string, or nil) to a string.
func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// toFloat coerces a decoded D1 JSON numeric value (encoding/json decodes
// JSON numbers into float64 for interface{} targets) to a float64.
func toFloat(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}
