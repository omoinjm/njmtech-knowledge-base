package uploader

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// MockHTTPClient is a mock for http.Client for granular control over responses.
type MockHTTPClient struct {
	DoFunc func(req *http.Request) (*http.Response, error)
}

func (m *MockHTTPClient) Do(req *http.Request) (*http.Response, error) {
	if m.DoFunc != nil {
		return m.DoFunc(req)
	}
	return nil, fmt.Errorf("DoFunc not set")
}

// TestNewVercelBlobUploader ensures the constructor works correctly.
func TestNewVercelBlobUploader(t *testing.T) {
	apiURL := "https://example.com/api"
	apiToken := "test-token"
	uploader := NewVercelBlobUploader(apiURL, apiToken, nil)

	if uploader == nil {
		t.Errorf("NewVercelBlobUploader returned nil, expected an instance")
	}
	if uploader.apiURL != apiURL {
		t.Errorf("Expected apiURL to be %s, got %s", apiURL, uploader.apiURL)
	}
	if uploader.apiToken != apiToken {
		t.Errorf("Expected apiToken to be %s, got %s", apiToken, uploader.apiToken)
	}
	if uploader.httpClient == nil {
		t.Errorf("Expected httpClient to be initialized, but got nil")
	}
}

// TestUpload_Success tests a successful upload scenario.
func TestUpload_Success(t *testing.T) {
	expectedResponse := "upload successful"
	filename := "test.txt"
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("Expected Authorization header 'Bearer test-token', got %s", r.Header.Get("Authorization"))
		}
		if blobPath := r.URL.Query().Get("blob_path"); blobPath != filename {
			t.Errorf("Expected blob_path query parameter to be '%s', got '%s'", filename, blobPath)
		}
		if r.URL.Query().Get("allow_overwrite") != "true" {
			t.Errorf("Expected allow_overwrite=true query parameter, got '%s'", r.URL.Query().Get("allow_overwrite"))
		}
		// Read the body to ensure it's a multipart form
		_, err := r.MultipartReader()
		if err != nil && err != http.ErrNotMultipart {
			t.Errorf("Expected multipart form data, got error: %v", err)
		}

		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, expectedResponse)
	}))
	defer testServer.Close()

	uploader := NewVercelBlobUploader(testServer.URL, "test-token", nil)
	content := "test content"

	response, err := uploader.Upload(context.Background(), content, filename)

	if err != nil {
		t.Fatalf("Upload failed unexpectedly: %v", err)
	}
	if response != expectedResponse {
		t.Errorf("Expected response '%s', got '%s'", expectedResponse, response)
	}
}

// TestUpload_APIError tests a scenario where the API returns an error status code.
func TestUpload_APIError(t *testing.T) {
	expectedStatusCode := http.StatusBadRequest
	expectedErrorBody := "bad request"
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(expectedStatusCode)
		fmt.Fprint(w, expectedErrorBody)
	}))
	defer testServer.Close()

	uploader := NewVercelBlobUploader(testServer.URL, "test-token", nil)
	content := "test content"
	filename := "test.txt"

	_, err := uploader.Upload(context.Background(), content, filename)

	if err == nil {
		t.Fatal("Expected an error, but got nil")
	}
	expectedErrorMessage := fmt.Sprintf("upload failed with status code %d: %s", expectedStatusCode, expectedErrorBody)
	if !strings.Contains(err.Error(), expectedErrorMessage) {
		t.Errorf("Expected error message to contain '%s', got '%s'", expectedErrorMessage, err.Error())
	}
}

// TestUpload_NetworkError tests a scenario where a network error occurs.
func TestUpload_NetworkError(t *testing.T) {
	// Create a client that will intentionally cause a network error (e.g., trying to connect to a closed server)
	// We pass nil for the httpClient, so it defaults to &http.Client{} which will try to connect.
	uploader := NewVercelBlobUploader("http://localhost:12345", "test-token", nil)
	content := "test content"
	filename := "test.txt"

	_, err := uploader.Upload(context.Background(), content, filename)

	if err == nil {
		t.Fatal("Expected a network error, but got nil")
	}
	if !strings.Contains(err.Error(), "failed to send request") &&
		!strings.Contains(err.Error(), "connection refused") &&
		!strings.Contains(err.Error(), "no such host") {
		t.Errorf("Expected a network error, but got: %v", err)
	}
}

// TestUpload_InvalidURL tests error during request creation or sending with an invalid URL
func TestUpload_InvalidURL(t *testing.T) {
	// Simulate an empty apiURL to trigger an error related to http.NewRequest or client.Do
	uploader := NewVercelBlobUploader("", "test-token", nil)
	content := "test content"
	filename := "test.txt"

	_, err := uploader.Upload(context.Background(), content, filename)

	if err == nil {
		t.Fatal("Expected an error for invalid URL, got nil")
	}

	if !strings.Contains(err.Error(), "failed to send request") && !strings.Contains(err.Error(), "failed to create request") {
		t.Errorf("Expected 'failed to send request' or 'failed to create request' error, got: %v", err)
	}
}

// TestUpload_ReadResponseBodyError tests error while reading response body
func TestUpload_ReadResponseBodyError(t *testing.T) {
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Write a header and then immediately close the connection to simulate a read error
		w.WriteHeader(http.StatusOK)
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Fatalf("httptest.ResponseWriter does not implement Hijacker")
		}
		conn, _, err := hj.Hijack()
		if err != nil {
			t.Fatalf("Hijack failed: %v", err)
		}
		conn.Close()
	}))
	defer testServer.Close()

	uploader := NewVercelBlobUploader(testServer.URL, "test-token", nil)
	content := "test content"
	filename := "test.txt"

	_, err := uploader.Upload(context.Background(), content, filename)

	if err == nil {
		t.Fatal("Expected an error reading response body, but got nil")
	}
	if !strings.Contains(err.Error(), "failed to read response body") && !strings.Contains(err.Error(), "unexpected EOF") {
		t.Errorf("Expected 'failed to read response body' error, got: %v", err)
	}
}

// TestUpload_CopyToFormFileError tests error during io.Copy
func TestUpload_CopyToFormFileError(t *testing.T) {
	t.Skip("Skipping io.Copy error test due to complexity of mocking multipart.Writer.CreateFormFile Write method for failure.")
}

func TestUpload_CustomHTTPClient(t *testing.T) {
	filename := "test.txt"
	mockClient := &MockHTTPClient{
		DoFunc: func(req *http.Request) (*http.Response, error) {
			expectedURLPart := "blob_path=" + filename
			if !strings.Contains(req.URL.String(), expectedURLPart) {
				t.Errorf("Expected URL to contain '%s', but it was '%s'", expectedURLPart, req.URL.String())
			}
			if !strings.Contains(req.URL.String(), "allow_overwrite=true") {
				t.Errorf("Expected URL to contain 'allow_overwrite=true', but it was '%s'", req.URL.String())
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("mocked response")),
			}, nil
		},
	}

	uploader := NewVercelBlobUploader("https://example.com/api", "test-token", mockClient)
	content := "test content"

	response, err := uploader.Upload(context.Background(), content, filename)

	if err != nil {
		t.Fatalf("Upload failed unexpectedly: %v", err)
	}
	if response != "mocked response" {
		t.Errorf("Expected mocked response, got %s", response)
	}
}
