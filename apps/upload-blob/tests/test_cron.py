
def test_cron_refresh_cache(test_env, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "super-secret")
    with patch("api.routers.cron.invalidate_cache") as mock_invalidate, \
         patch("api.routers.cron.list_blobs") as mock_list:
        
        mock_list.return_value = [{"path": "test"}]
        client = test_env
        headers = {"Authorization": "Bearer super-secret"}
        response = client.get("/api/cron/refresh-cache", headers=headers)
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_invalidate.assert_called_once()
        mock_list.assert_called_once()

def test_cron_refresh_cache_unauthorized(test_env, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "super-secret")
    client = test_env
    headers = {"Authorization": "Bearer wrong-secret"}
    response = client.get("/api/cron/refresh-cache", headers=headers)
    assert response.status_code == 401
