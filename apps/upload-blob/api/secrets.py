import os
import sys
import json

_initialized = False
_cache = None

def load_secrets(env_source=None):
    """
    Synchronous secret loading for non-Worker environments.
    """
    global _initialized
    if _initialized and env_source is None:
        return
    _initialized = True

    def get_bootstrap_env(key):
        if env_source and hasattr(env_source, key):
            return getattr(env_source, key)
        if env_source and isinstance(env_source, dict) and key in env_source:
            return env_source[key]
        return os.getenv(key)

    client_id = get_bootstrap_env("INFISICAL_CLIENT_ID")
    client_secret = get_bootstrap_env("INFISICAL_CLIENT_SECRET")
    project_id = get_bootstrap_env("INFISICAL_PROJECT_ID")

    if not all([client_id, client_secret, project_id]):
        return

    environment = get_bootstrap_env("INFISICAL_ENVIRONMENT") or "dev"
    site_url = get_bootstrap_env("INFISICAL_SITE_URL") or "https://app.infisical.com"

    try:
        if "pyodide" in sys.modules:
            # We skip SDK loading in Pyodide due to lack of 'ssl' support.
            # Use async_load_secrets for dynamic fetching in Workers.
            return

        from infisical_sdk import InfisicalSDKClient
        
        client = InfisicalSDKClient(host=site_url)
        client.auth.universal_auth.login(client_id=client_id, client_secret=client_secret)

        secrets_response = client.secrets.list_secrets(
            project_id=project_id,
            environment_slug=environment,
            secret_path="/",  
            expand_secret_references=True
        )

        loaded_count = 0
        for secret in secrets_response.secrets:
            key = secret.secretKey
            val = secret.secretValue
            os.environ[key] = val
            if env_source is not None:
                _inject_into_env(env_source, key, val)
            loaded_count += 1
        
        print(f"[infisical] Successfully loaded {loaded_count} secret(s) from '{environment}'")
    except Exception as e:
        print(f"[infisical] Failed to load secrets: {e}")

async def async_load_secrets(env_source):
    """
    Asynchronous secret loading specifically for Cloudflare Workers (Pyodide).
    Uses the REST API via js.fetch to bypass 'ssl' module limitations.
    """
    global _cache
    
    def get_bootstrap_env(key):
        if hasattr(env_source, key):
            return getattr(env_source, key)
        if isinstance(env_source, dict) and key in env_source:
            return env_source[key]
        return os.getenv(key)

    if _cache is not None:
        for key, val in _cache.items():
            _inject_into_env(env_source, key, val)
        return

    client_id = get_bootstrap_env("INFISICAL_CLIENT_ID")
    client_secret = get_bootstrap_env("INFISICAL_CLIENT_SECRET")
    project_id = get_bootstrap_env("INFISICAL_PROJECT_ID")

    if not all([client_id, client_secret, project_id]):
        return

    environment = get_bootstrap_env("INFISICAL_ENVIRONMENT") or "dev"
    site_url = (get_bootstrap_env("INFISICAL_SITE_URL") or "https://app.infisical.com").rstrip("/")

    try:
        import js
        from pyodide.ffi import to_js
        
        # 1. Login to get Access Token
        login_body = json.dumps({"clientId": client_id, "clientSecret": client_secret})
        login_init = to_js(
            {
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": login_body,
            },
            dict_converter=js.Object.fromEntries,
        )
        login_res = await js.fetch(
            f"{site_url}/api/v1/auth/universal-auth/login",
            login_init,
        )
        
        if not login_res.ok:
            print(f"[infisical] Login failed with status {login_res.status}")
            return
            
        login_data = await login_res.json()
        token = login_data.accessToken

        # 2. Fetch Raw Secrets
        secrets_url = f"{site_url}/api/v3/secrets/raw?environment={environment}&workspaceId={project_id}&secretPath=/"
        secrets_init = to_js(
            {"headers": {"Authorization": f"Bearer {token}"}},
            dict_converter=js.Object.fromEntries,
        )
        secrets_res = await js.fetch(secrets_url, secrets_init)
        
        if not secrets_res.ok:
            print(f"[infisical] Secrets fetch failed with status {secrets_res.status}")
            return
            
        secrets_data = await secrets_res.json()
        
        new_cache = {}
        for secret in secrets_data.secrets:
            key = secret.secretKey
            val = secret.secretValue
            new_cache[key] = val
            _inject_into_env(env_source, key, val)
            os.environ[key] = val
            
        _cache = new_cache
        print(f"[infisical] Successfully fetched {len(_cache)} secret(s) via REST API")
        
    except Exception as e:
        print(f"[infisical] Runtime secret fetch failed: {e}")

def _inject_into_env(env_source, key, val):
    if isinstance(env_source, dict):
        env_source[key] = val
    elif hasattr(env_source, "__setattr__"):
        try:
            setattr(env_source, key, val)
        except Exception:
            pass
