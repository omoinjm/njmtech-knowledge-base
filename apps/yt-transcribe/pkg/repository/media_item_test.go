package repository

import (
	"context"
	"errors"
	"testing"
)

// mockRepo is a test double for MediaItemRepository.
type mockRepo struct {
	fetchResult    *MediaItem
	fetchErr       error
	fetchAllResult []MediaItem
	fetchAllErr    error
	updateErr      error

	lastUpdateID  string
	lastUpdateURL string
}

func (m *mockRepo) FetchNextUnprocessed(_ context.Context, _ []string) (*MediaItem, error) {
	return m.fetchResult, m.fetchErr
}

func (m *mockRepo) FetchAll(_ context.Context) ([]MediaItem, error) {
	return m.fetchAllResult, m.fetchAllErr
}

func (m *mockRepo) UpdateTranscriptURL(_ context.Context, id, transcriptURL string) error {
	m.lastUpdateID = id
	m.lastUpdateURL = transcriptURL
	return m.updateErr
}

func (m *mockRepo) RecordRetryFailure(_ context.Context, _ string, _ string) (string, bool, error) {
	return "", false, nil
}

func (m *mockRepo) ClearRetryFailure(_ context.Context, _ string) error {
	return nil
}

func (m *mockRepo) EarliestRetryAfter(_ context.Context) (string, bool, error) {
	return "", false, nil
}

func (m *mockRepo) GetRetryState(_ context.Context, _ string) (*RetryStateInfo, error) {
	return nil, nil
}

// Verify mockRepo satisfies the interface at compile time.
var _ MediaItemRepository = (*mockRepo)(nil)

func TestFetchNextUnprocessed_ReturnsItem(t *testing.T) {
	expected := &MediaItem{
		ID:       "abc-123",
		URL:      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		Platform: "youtube",
		VideoID:  "dQw4w9WgXcQ",
	}
	repo := &mockRepo{fetchResult: expected}

	item, err := repo.FetchNextUnprocessed(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil {
		t.Fatal("expected a MediaItem, got nil")
	}
	if item.ID != expected.ID {
		t.Errorf("ID: want %q, got %q", expected.ID, item.ID)
	}
	if item.URL != expected.URL {
		t.Errorf("URL: want %q, got %q", expected.URL, item.URL)
	}
	if item.Platform != expected.Platform {
		t.Errorf("Platform: want %q, got %q", expected.Platform, item.Platform)
	}
	if item.VideoID != expected.VideoID {
		t.Errorf("VideoID: want %q, got %q", expected.VideoID, item.VideoID)
	}
}

func TestFetchNextUnprocessed_ReturnsNilWhenEmpty(t *testing.T) {
	repo := &mockRepo{fetchResult: nil, fetchErr: nil}

	item, err := repo.FetchNextUnprocessed(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item != nil {
		t.Errorf("expected nil item when queue is empty, got %+v", item)
	}
}

func TestFetchNextUnprocessed_PropagatesError(t *testing.T) {
	expectedErr := errors.New("connection refused")
	repo := &mockRepo{fetchErr: expectedErr}

	_, err := repo.FetchNextUnprocessed(context.Background(), nil)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !errors.Is(err, expectedErr) {
		t.Errorf("want %v, got %v", expectedErr, err)
	}
}

func TestUpdateTranscriptURL_StoresValues(t *testing.T) {
	repo := &mockRepo{}
	id := "abc-123"
	blobURL := "https://blob.vercel-storage.com/yt-transcribe/youtube/dQw4w9WgXcQ"

	if err := repo.UpdateTranscriptURL(context.Background(), id, blobURL); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastUpdateID != id {
		t.Errorf("ID: want %q, got %q", id, repo.lastUpdateID)
	}
	if repo.lastUpdateURL != blobURL {
		t.Errorf("URL: want %q, got %q", blobURL, repo.lastUpdateURL)
	}
}

func TestUpdateTranscriptURL_PropagatesError(t *testing.T) {
	expectedErr := errors.New("update failed")
	repo := &mockRepo{updateErr: expectedErr}

	err := repo.UpdateTranscriptURL(context.Background(), "id", "url")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !errors.Is(err, expectedErr) {
		t.Errorf("want %v, got %v", expectedErr, err)
	}
}

func TestFetchAll_ReturnsAllItems(t *testing.T) {
	expected := []MediaItem{
		{ID: "1", URL: "https://youtube.com/watch?v=aaa", Platform: "youtube", VideoID: "aaa"},
		{ID: "2", URL: "https://youtube.com/watch?v=bbb", Platform: "youtube", VideoID: "bbb"},
	}
	repo := &mockRepo{fetchAllResult: expected}

	items, err := repo.FetchAll(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != len(expected) {
		t.Fatalf("want %d items, got %d", len(expected), len(items))
	}
	for i, item := range items {
		if item.ID != expected[i].ID {
			t.Errorf("item[%d].ID: want %q, got %q", i, expected[i].ID, item.ID)
		}
		if item.URL != expected[i].URL {
			t.Errorf("item[%d].URL: want %q, got %q", i, expected[i].URL, item.URL)
		}
	}
}

func TestFetchAll_ReturnsEmptySliceWhenNoRows(t *testing.T) {
	repo := &mockRepo{fetchAllResult: nil}

	items, err := repo.FetchAll(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected empty slice, got %d items", len(items))
	}
}

func TestFetchAll_PropagatesError(t *testing.T) {
	expectedErr := errors.New("db connection lost")
	repo := &mockRepo{fetchAllErr: expectedErr}

	_, err := repo.FetchAll(context.Background())
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !errors.Is(err, expectedErr) {
		t.Errorf("want %v, got %v", expectedErr, err)
	}
}
