from api.config import Settings
from api.secrets import async_load_secrets


def extract_bearer_token(request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth[len("Bearer ") :]


async def load_settings(env) -> Settings:
    await async_load_secrets(env)
    return Settings.load(env_source=env)


async def authorize(request, env) -> Settings | None:
    settings = await load_settings(env)
    token = extract_bearer_token(request)
    if token != settings.UPLOAD_BLOB_API_TOKEN:
        return None
    return settings
