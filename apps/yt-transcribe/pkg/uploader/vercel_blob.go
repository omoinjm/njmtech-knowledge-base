package uploader

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
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
func (v *VercelBlobUploader) Upload(ctx context.Context, content string, filename string) (string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, bytes.NewReader([]byte(content))); err != nil {
		return "", fmt.Errorf("failed to copy content to form file: %w", err)
	}

	writer.Close()

	// URL-encode the filename to safely include it in the query string.
	// allowOverwrite=true is required when reprocessing existing blobs.
	encodedFilename := url.QueryEscape(filename)
	uploadURL := fmt.Sprintf("%s?blob_path=%s&allow_overwrite=true", v.apiURL, encodedFilename)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+v.apiToken)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed with status code %d: %s", resp.StatusCode, string(respBody))
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	return string(respBody), nil
}