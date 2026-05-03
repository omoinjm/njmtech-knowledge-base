package repository

import (
	"context"
	"errors"
	"fmt"

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
	return &PostgresMediaItemRepository{pool: pool}, nil
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
		AND    NOT (id = ANY($1::uuid[]))
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
	const query = `UPDATE media_items SET transcript_url = $1 WHERE id = $2::uuid`

	tag, err := r.pool.Exec(ctx, query, transcriptURL, id)
	if err != nil {
		return fmt.Errorf("failed to update transcript_url for id %s: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no row found with id %s", id)
	}
	return nil
}
