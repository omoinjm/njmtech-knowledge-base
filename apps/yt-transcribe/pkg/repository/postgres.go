package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresMediaItemRepository implements MediaItemRepository against a Neon / Postgres database.
// It uses a connection pool so that connections dropped by the server (e.g. Neon's idle-connection
// timeout during long transcription jobs) are transparently re-acquired.
type PostgresMediaItemRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresMediaItemRepository creates a connection pool to the database at the given connString
// (i.e. the POSTGRES_URL env var) and returns a ready-to-use repository.
// The caller is responsible for calling Close() when finished.
func NewPostgresMediaItemRepository(ctx context.Context, connString string) (*PostgresMediaItemRepository, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection string: %w", err)
	}

	// Use simple query protocol so this pool works with both Neon's PgBouncer
	// pooler endpoint and a direct connection. PgBouncer in transaction mode
	// does not support extended query protocol (prepared statements).
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Ping every connection before handing it out so connections dropped by
	// Neon's idle-connection timeout are never returned to callers.
	config.BeforeAcquire = func(ctx context.Context, conn *pgx.Conn) bool {
		return conn.Ping(ctx) == nil
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	repo := &PostgresMediaItemRepository{pool: pool}
	if err := repo.ensureRetryTable(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return repo, nil
}

// Close releases all connections in the pool.
func (r *PostgresMediaItemRepository) Close(_ context.Context) error {
	r.pool.Close()
	return nil
}

// FetchNextUnprocessed atomically claims one row for processing by taking a row lock
// inside a short transaction. Using SKIP LOCKED prevents concurrent workers from
// selecting the same row.
// Returns nil, nil when every item has already been processed.
func (r *PostgresMediaItemRepository) FetchNextUnprocessed(ctx context.Context, excludedIDs []string) (*MediaItem, error) {
	if excludedIDs == nil {
		excludedIDs = []string{}
	}

	const query = `
		SELECT id, url, platform, video_id
		FROM   media_items
		WHERE  transcript_url IS NULL
		AND    NOT EXISTS (
			SELECT 1
			FROM media_item_retry_state rs
			WHERE rs.media_item_id = media_items.id
			AND rs.next_attempt > NOW()
		)
		AND    NOT (id::text = ANY($1::text[]))
		ORDER  BY created_at ASC
		FOR UPDATE SKIP LOCKED
		LIMIT  1`

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction for next unprocessed item: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, query, excludedIDs)

	var item MediaItem
	err = row.Scan(&item.ID, &item.URL, &item.Platform, &item.VideoID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to fetch next unprocessed item: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction for next unprocessed item: %w", err)
	}
	return &item, nil
}

func (r *PostgresMediaItemRepository) ensureRetryTable(ctx context.Context) error {
	const stmt = `
		CREATE TABLE IF NOT EXISTS media_item_retry_state (
			media_item_id UUID PRIMARY KEY,
			failures INTEGER NOT NULL DEFAULT 0,
			next_attempt TIMESTAMPTZ NOT NULL,
			last_error TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if _, err := r.pool.Exec(ctx, stmt); err != nil {
		return fmt.Errorf("failed to ensure media_item_retry_state table: %w", err)
	}
	return nil
}

// FetchAll returns every row in media_items ordered by created_at ASC.
func (r *PostgresMediaItemRepository) FetchAll(ctx context.Context) ([]MediaItem, error) {
	const query = `
		SELECT id, url, platform, video_id
		FROM   media_items
		ORDER  BY created_at ASC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch all items: %w", err)
	}
	defer rows.Close()

	var items []MediaItem
	for rows.Next() {
		var item MediaItem
		if err := rows.Scan(&item.ID, &item.URL, &item.Platform, &item.VideoID); err != nil {
			return nil, fmt.Errorf("failed to scan media item row: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating media item rows: %w", err)
	}
	return items, nil
}

// UpdateTranscriptURL sets transcript_url for the row identified by id.
func (r *PostgresMediaItemRepository) UpdateTranscriptURL(ctx context.Context, id, transcriptURL string) error {
	const query = `UPDATE media_items SET transcript_url = $1 WHERE id::text = $2`

	tag, err := r.pool.Exec(ctx, query, transcriptURL, id)
	if err != nil {
		return fmt.Errorf("failed to update transcript_url for id %s: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no row found with id %s", id)
	}
	return nil
}

func (r *PostgresMediaItemRepository) RecordRetryFailure(ctx context.Context, id, errMsg string) (string, bool, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", false, fmt.Errorf("failed to begin retry-state transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var failures int
	const selectStmt = `SELECT failures FROM media_item_retry_state WHERE media_item_id::text = $1`
	selectErr := tx.QueryRow(ctx, selectStmt, id).Scan(&failures)
	if selectErr != nil && !errors.Is(selectErr, pgx.ErrNoRows) {
		return "", false, fmt.Errorf("failed to read retry-state row for id %s: %w", id, selectErr)
	}
	if errors.Is(selectErr, pgx.ErrNoRows) {
		failures = 0
	}
	failures++

	isPermanent := IsPermanentError(errMsg)
	nextDelay := retryDelay(errMsg, failures)
	nextAttempt := time.Now().Add(nextDelay).UTC()

	const upsertStmt = `
		INSERT INTO media_item_retry_state (media_item_id, failures, next_attempt, last_error, updated_at)
		VALUES ($1::uuid, $2, $3, $4, NOW())
		ON CONFLICT (media_item_id)
		DO UPDATE SET
			failures = EXCLUDED.failures,
			next_attempt = EXCLUDED.next_attempt,
			last_error = EXCLUDED.last_error,
			updated_at = NOW()`
	if _, err := tx.Exec(ctx, upsertStmt, id, failures, nextAttempt, errMsg); err != nil {
		return "", false, fmt.Errorf("failed to upsert retry-state row for id %s: %w", id, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", false, fmt.Errorf("failed to commit retry-state transaction for id %s: %w", id, err)
	}

	return nextAttempt.Format(time.RFC3339), isPermanent, nil
}

func (r *PostgresMediaItemRepository) ClearRetryFailure(ctx context.Context, id string) error {
	const stmt = `DELETE FROM media_item_retry_state WHERE media_item_id::text = $1`
	if _, err := r.pool.Exec(ctx, stmt, id); err != nil {
		return fmt.Errorf("failed to clear retry-state row for id %s: %w", id, err)
	}
	return nil
}

func (r *PostgresMediaItemRepository) EarliestRetryAfter(ctx context.Context) (string, bool, error) {
	const stmt = `SELECT MIN(next_attempt) FROM media_item_retry_state WHERE next_attempt > NOW()`
	var ts *time.Time
	if err := r.pool.QueryRow(ctx, stmt).Scan(&ts); err != nil {
		return "", false, fmt.Errorf("failed to query earliest retry attempt: %w", err)
	}
	if ts == nil {
		return "", false, nil
	}
	return ts.UTC().Format(time.RFC3339), true, nil
}

func (r *PostgresMediaItemRepository) GetRetryState(ctx context.Context, id string) (*RetryStateInfo, error) {
	const stmt = `
		SELECT media_item_id::text, failures, next_attempt, last_error, updated_at
		FROM media_item_retry_state
		WHERE media_item_id::text = $1`
	var (
		info        RetryStateInfo
		nextAttempt time.Time
		updatedAt   time.Time
	)
	err := r.pool.QueryRow(ctx, stmt, id).Scan(
		&info.MediaItemID,
		&info.Failures,
		&nextAttempt,
		&info.LastError,
		&updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query retry-state row for id %s: %w", id, err)
	}
	info.NextAttempt = nextAttempt.UTC().Format(time.RFC3339)
	info.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return &info, nil
}
