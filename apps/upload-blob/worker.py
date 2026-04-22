from api.main import app
from workers import WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi

        # The env object contains your environment variables/secrets
        return await asgi.fetch(app, request.js_object, self.env)
