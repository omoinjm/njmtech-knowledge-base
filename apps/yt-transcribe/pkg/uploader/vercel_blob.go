package uploader

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"unicode"
)

// HTTPClient interface for mocking purposes
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// VercelBlobUploader implements the Uploader interface for Vercel Blob storage.
type VercelBlobUploader struct {
	apiURL     string
	apiToken   string
	httpClient HTTPClient
}

// NewVercelBlobUploader creates a new VercelBlobUploader.
func NewVercelBlobUploader(apiURL, apiToken string, client HTTPClient) *VercelBlobUploader {
	if client == nil {
		client = &http.Client{}
	}
	return &VercelBlobUploader{
		apiURL:     apiURL,
		apiToken:   apiToken,
		httpClient: client,
	}
}

// Upload uploads the given content to Vercel Blob storage.
// The input value is treated as a blob path (folder path).
func (v *VercelBlobUploader) Upload(ctx context.Context, content string, blobPath string) (string, error) {
	respBody, statusCode, err := v.uploadOnce(ctx, content, blobPath)
	if err != nil {
		return "", err
	}
	if statusCode == http.StatusOK {
		return respBody, nil
	}

	// Some backends enforce stricter pathname rules than Vercel Blob itself.
	// If rejected, retry once with a flattened/sanitized pathname.
	if strings.Contains(respBody, "Invalid pathname") {
		fallback := sanitizeBlobPath(blobPath)
		if fallback != strings.Trim(blobPath, "/") {
			respBody, statusCode, err = v.uploadOnce(ctx, content, fallback)
			if err != nil {
				return "", err
			}
			if statusCode == http.StatusOK {
				return respBody, nil
			}
		}
	}

	return "", fmt.Errorf("upload failed with status code %d: %s", statusCode, respBody)
}

func (v *VercelBlobUploader) uploadOnce(ctx context.Context, content string, blobPath string) (string, int, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Keep legacy upload-blob naming semantics:
	// file.name = "yt-transcribe_<platform>_<videoId>" (no extension)
	// upload-blob appends ".txt" for non-md filenames.
	formFileName := strings.ReplaceAll(strings.Trim(blobPath, "/"), "/", "_")
	if formFileName == "" {
		formFileName = "transcript"
	}

	part, err := writer.CreateFormFile("file", formFileName)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, bytes.NewReader([]byte(content))); err != nil {
		return "", 0, fmt.Errorf("failed to copy content to form file: %w", err)
	}

	writer.Close()

	// URL-encode the filename to safely include it in the query string.
	// allowOverwrite=true is required when reprocessing existing blobs.
	encodedBlobPath := url.QueryEscape(strings.Trim(blobPath, "/"))
	uploadURL := fmt.Sprintf("%s?blob_path=%s&allow_overwrite=true", v.apiURL, encodedBlobPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+v.apiToken)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response body: %w", err)
	}

	return string(respBody), resp.StatusCode, nil
}

func sanitizeBlobPath(blobPath string) string {
	trimmed := strings.Trim(blobPath, "/")
	if trimmed == "" {
		return "transcript.txt"
	}

	flattened := strings.ReplaceAll(trimmed, "/", "_")
	var b strings.Builder
	b.Grow(len(flattened))
	for _, r := range flattened {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '.' || r == '-' || r == '_' {
			b.WriteRune(r)
			continue
		}
		b.WriteByte('_')
	}

	safe := strings.Trim(b.String(), "._-")
	if safe == "" {
		safe = "transcript"
	}
	if !strings.Contains(safe, ".") {
		safe += ".txt"
	}
	return safe
}
