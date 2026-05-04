# Copilot Instructions

## yt-transcribe Worker

### Adding or updating routes

When you add, remove, or modify a route in `apps/yt-transcribe/worker.mjs` or `apps/yt-transcribe/main.go`, you **must** keep the following two files in sync:

1. **`apps/yt-transcribe/docs/openapi.json`** — the OpenAPI 3.1 spec. Update the `paths` object to reflect the change (add/remove/rename paths, update request/response schemas).

2. **`apps/yt-transcribe/worker.mjs` — `OPENAPI_SPEC` constant** (line 2) — this is the minified, JSON-stringified copy of `openapi.json` that gets served at `/docs/openapi.json` at runtime. After editing `openapi.json`, regenerate it with:

   ```bash
   python3 - <<'EOF'
   import json

   with open('apps/yt-transcribe/docs/openapi.json') as f:
       data = json.load(f)

   with open('apps/yt-transcribe/worker.mjs') as f:
       content = f.read()

   lines = [l for l in content.split('\n') if not l.startswith('const OPENAPI_SPEC =')]
   content = '\n'.join(lines)

   compact = json.dumps(data, separators=(',', ':'))
   const_line = f'const OPENAPI_SPEC = {json.dumps(compact)};'

   lines = content.split('\n')
   insert_at = next(i for i, l in enumerate(lines) if l.startswith('import ')) + 1
   lines.insert(insert_at, const_line)

   with open('apps/yt-transcribe/worker.mjs', 'w') as f:
       f.write('\n'.join(lines))

   print(f"Done. {len(const_line)} chars")
   EOF
   ```

### Docs URL

Once deployed, the Swagger UI is available at:

- **UI:** `https://yt-transcribe-worker.njmalaza.workers.dev/docs`
- **Raw spec:** `https://yt-transcribe-worker.njmalaza.workers.dev/docs/openapi.json`

### Route overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | — | Health check (API container) |
| `POST` | `/api/transcribe` | — | Transcribe a YouTube URL |
| `GET` | `/admin/state` | ✓ | Container states |
| `POST` | `/admin/jobs/db` | ✓ | Trigger DB transcription job |
| `POST` | `/admin/jobs/reprocess-all` | ✓ | Re-transcribe all media items |
| `GET` | `/admin/job-result` | ✓ | Last job result/error message |
| `GET` | `/admin/test-env` | ✓ | Check env vars set in container |
| `GET` | `/admin/test-db` | ✓ | Test DB connectivity + row count |
| `GET` | `/docs` | — | Swagger UI |
| `GET` | `/docs/openapi.json` | — | OpenAPI 3.1 spec |

Auth = `Authorization: Bearer <YT_TRANSCRIBE_ADMIN_TOKEN>`.
