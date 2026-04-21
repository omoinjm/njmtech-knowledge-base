import pytest
from fastapi.testclient import TestClient
import os
from werkzeug.utils import secure_filename
from unittest.mock import patch
from datetime import datetime
import importlib

# import api modules to be reloaded
import api.config
import api.dependencies
import api.main


# Create a dummy file for testing
DUMMY_FILE_CONTENT = b"Hello, this is a test file."
DUMMY_FILE_NAME = "test file with spaces & special chars.txt"
API_TOKEN = "test-token"
FIXED_DATETIME = datetime(2023, 1, 1, 12, 0, 0)
FIXED_DATETIME_STR = FIXED_DATETIME.strftime("%Y-%m-%d-%H-%M-%S")

@pytest.fixture(scope="function")
def test_env(monkeypatch):
    monkeypatch.setenv("API_TOKEN", API_TOKEN)
    importlib.reload(api.config)
    importlib.reload(api.dependencies)
    app = importlib.reload(api.main).app
    client = TestClient(app)
    return client

@pytest.fixture(scope="function", autouse=True)
def create_dummy_file():
    with open(DUMMY_FILE_NAME, "wb") as f:
        f.write(DUMMY_FILE_CONTENT)
    yield
    os.remove(DUMMY_FILE_NAME)


def test_upload_file(test_env):
    with patch("api.routers.vercel_blob.upload_to_blob_storage") as mock_upload_to_blob_storage:
        client = test_env
        sanitized_filename = secure_filename(DUMMY_FILE_NAME)
        blob_path = "test-path"
        expected_path = f"njmtech-blob-api/{blob_path}/{sanitized_filename}.txt"
        mock_upload_to_blob_storage.return_value = (f"https://fake-blob-storage.com/{expected_path}", expected_path)
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        with open(DUMMY_FILE_NAME, "rb") as f:
            response = client.post(f"/api/v1/blob/upload?blob_path={blob_path}", files={"file": (DUMMY_FILE_NAME, f, "text/plain")}, headers=headers)
        
        assert response.status_code == 200
        assert response.json()["url"] == f"https://fake-blob-storage.com/{expected_path}"
        mock_upload_to_blob_storage.assert_called_once_with(DUMMY_FILE_NAME, DUMMY_FILE_CONTENT, blob_path)

def test_upload_file_no_token(test_env):
    client = test_env
    with open(DUMMY_FILE_NAME, "rb") as f:
        response = client.post("/api/v1/blob/upload?blob_path=test", files={"file": (DUMMY_FILE_NAME, f, "text/plain")})
    assert response.status_code == 401
    assert response.json()["error"]["detail"] == "Authorization header is missing"
    assert response.json()["error"]["title"] == "Unauthorized"
    assert response.json()["error"]["type"] == "https://example.com/errors/unauthorized"


def test_upload_file_invalid_token(test_env):
    client = test_env
    headers = {"Authorization": "Bearer invalid-token"}
    with open(DUMMY_FILE_NAME, "rb") as f:
        response = client.post("/api/v1/blob/upload?blob_path=test", files={"file": (DUMMY_FILE_NAME, f, "text/plain")}, headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["detail"] == "Invalid token"
    assert response.json()["error"]["title"] == "Unauthorized"
    assert response.json()["error"]["type"] == "https://example.com/errors/unauthorized"


def test_upload_no_file(test_env):
    client = test_env
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    response = client.post("/api/v1/blob/upload?blob_path=test", headers=headers)
    assert response.status_code == 422
    assert "detail" in response.json()
    assert response.json()["detail"][0]["msg"] == "Field required"


def test_health_check(test_env):
    client = test_env
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_list_files(test_env):
    with patch("api.routers.vercel_blob.list_blobs") as mock_list_blobs:
        client = test_env
        mock_blobs_data = [
            {"url": "https://fake-blob-storage.com/njmtech-blob-api/2023-01-01-12-00-00/file1.txt", "path": "njmtech-blob-api/2023-01-01-12-00-00/file1.txt"},
            {"url": "https://fake-blob-storage.com/njmtech-blob-api/2023-01-01-12-00-00/file2.txt", "path": "njmtech-blob-api/2023-01-01-12-00-00/file2.txt"},
        ]
        mock_list_blobs.return_value = mock_blobs_data
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        response = client.get("/api/v1/blob/files", headers=headers)
        assert response.status_code == 200
        assert response.json()["data"] == mock_blobs_data
        mock_list_blobs.assert_called_once()

def test_delete_blob(test_env):
    with patch("api.routers.vercel_blob.delete_from_blob_storage") as mock_delete_from_blob_storage:
        client = test_env
        url = "https://fake-blob-storage.com/njmtech-blob-api/test.txt"
        mock_delete_from_blob_storage.return_value = True
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        response = client.delete(f"/api/v1/blob/delete?url={url}", headers=headers)
        assert response.status_code == 200
        assert response.json() == {"message": "Blob deleted successfully"}
        mock_delete_from_blob_storage.assert_called_once_with(url)

def test_delete_blob_not_found(test_env):
    with patch("api.routers.vercel_blob.delete_from_blob_storage") as mock_delete_from_blob_storage:
        client = test_env
        url = "https://fake-blob-storage.com/njmtech-blob-api/missing.txt"
        mock_delete_from_blob_storage.return_value = False
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        response = client.delete(f"/api/v1/blob/delete?url={url}", headers=headers)
        assert response.status_code == 404
        assert response.json() == {"message": "Blob not found or deletion failed"}
        mock_delete_from_blob_storage.assert_called_once_with(url)

def test_list_files_prefix(test_env):
    with patch("api.services.blob_storage.vercel_blob.list") as mock_vercel_blob_list, \
         patch("api.services.blob_storage.r") as mock_redis:
        mock_redis.get.return_value = None  # Force cache miss
        client = test_env
        mock_vercel_blob_list.return_value = {"blobs": []}
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        response = client.get("/api/v1/blob/files", headers=headers)
        assert response.status_code == 200
        mock_vercel_blob_list.assert_called_once_with({"prefix": "njmtech-blob-api/"})

def test_upload_file_blob_storage_error(test_env):
    with patch("api.routers.vercel_blob.upload_to_blob_storage") as mock_upload_to_blob_storage:
        client = test_env
        mock_upload_to_blob_storage.side_effect = Exception("Blob storage is down")
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        with open(DUMMY_FILE_NAME, "rb") as f:
            response = client.post("/api/v1/blob/upload?blob_path=test", files={"file": (DUMMY_FILE_NAME, f, "text/plain")}, headers=headers)
        
        assert response.status_code == 500
        response_json = response.json()
        assert response_json["error"]["detail"] == "An unexpected error occurred."
        assert response_json["error"]["title"] == "Internal Server Error"
        assert "http" in response_json["error"]["instance"]
        assert response_json["error"]["type"] == "https://example.com/errors/internal-server-error"
        assert response_json["error"]["additional_info"] == {"original_error": "Blob storage is down"}
