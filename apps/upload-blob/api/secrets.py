import os
from infisical_sdk import InfisicalSDKClient

_initialized = False

def load_secrets():
    """
    Fetches secrets from Infisical and injects them into os.environ.
    
    Required env vars (bootstrap only):
      INFISICAL_CLIENT_ID      — Machine Identity client ID
      INFISICAL_CLIENT_SECRET  — Machine Identity client secret
      INFISICAL_PROJECT_ID     — Infisical project ID
    
    Optional:
      INFISICAL_ENVIRONMENT    — dev | staging | prod (default: "dev")
      INFISICAL_SITE_URL       — self-hosted instance URL (default: https://app.infisical.com)
    """
    global _initialized
    if _initialized:
        return
    _initialized = True

    client_id = os.getenv("INFISICAL_CLIENT_ID")
    client_secret = os.getenv("INFISICAL_CLIENT_SECRET")
    project_id = os.getenv("INFISICAL_PROJECT_ID")

    if not all([client_id, client_secret, project_id]):
        # No Infisical configuration found, skip secret loading (local dev)
        return

    environment = os.getenv("INFISICAL_ENVIRONMENT", "dev")
    site_url = os.getenv("INFISICAL_SITE_URL", "https://app.infisical.com")

    try:
        client = InfisicalSDKClient(host=site_url)
        client.auth.universal_auth.login(client_id=client_id, client_secret=client_secret)

        secrets = client.secrets.list_secrets(
            project_id=project_id,
            environment_slug=environment,
            secret_path="/",  
            expand_secret_references=True
        )

        loaded_count = 0
        for secret in secrets.secrets:
            # Only set if not already overridden locally
            if secret.secretKey not in os.environ:
                os.environ[secret.secretKey] = secret.secretValue
                loaded_count += 1
        
        print(f"[infisical] Loaded {loaded_count} secret(s) from '{environment}' environment")
    except Exception as e:
        print(f"[infisical] Failed to load secrets: {e}")
