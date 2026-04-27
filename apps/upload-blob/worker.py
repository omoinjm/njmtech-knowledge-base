from api.runtime.worker_app import handle_request, run_scheduled_refresh
from workers import WorkerEntrypoint


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await handle_request(request, self.env)

    async def scheduled(self, controller):
        # Native Cloudflare cron trigger handler.
        await run_scheduled_refresh(self.env)
