from api.runtime.http import html_response, json_response

HOME_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vercel blob upload</title>
    <link rel="icon" type="image/x-icon" href="https://res.cloudinary.com/dfta3fn6p/image/upload/v1767616954/favicon_xezewp.ico">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #000000; color: #ffffff; line-height: 1.6; min-height: 100vh; display: flex; flex-direction: column;
        }
        header { border-bottom: 1px solid #333333; padding: 0; }
        nav { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; padding: 1rem 2rem; gap: 2rem; }
        .logo { font-size: 1.25rem; font-weight: 600; color: #ffffff; text-decoration: none; }
        .logo img { width: 150px; height: auto; max-width: 100%; }
        main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .hero { margin-bottom: 3rem; }
        .hero-code { margin-top: 2rem; width: 100%; max-width: 900px; }
        .hero-code pre { background-color: #0a0a0a; border: 1px solid #333333; border-radius: 8px; padding: 1.5rem; text-align: left; margin: 0; overflow-x: auto; }
        .hero-code code {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: clamp(0.75rem, 1.5vw, 0.85rem); line-height: 1.5; display: block; white-space: pre;
        }
        h1 {
            font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; margin-bottom: 1rem;
            background: linear-gradient(to right, #ffffff, #888888);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; width: 100%; max-width: 900px; }
        .card { background-color: #111111; border: 1px solid #333333; border-radius: 8px; padding: 1.5rem; transition: all 0.2s ease; text-align: left; }
        .card:hover { border-color: #555555; transform: translateY(-2px); }
        .card h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #ffffff; }
        .card p { color: #888888; font-size: 0.875rem; margin-bottom: 1rem; }
        .card a {
            display: inline-flex; align-items: center; color: #ffffff; text-decoration: none;
            font-size: 0.875rem; font-weight: 500; padding: 0.5rem 1rem;
            background-color: #222222; border-radius: 6px; border: 1px solid #333333; transition: all 0.2s ease;
        }
        .card a:hover { background-color: #333333; border-color: #555555; }
    </style>
</head>
<body>
    <header>
        <nav>
            <a href="/" class="logo">
                <img src="https://res.cloudinary.com/dfta3fn6p/image/upload/c_crop,ar_16:9/v1676064214/public/logo/NJMTECHw_jdxtl0.png" alt="logo image" />
            </a>
        </nav>
    </header>
    <main>
        <div class="hero">
            <h1>Vercel blob upload</h1>
            <div class="hero-code">
                <pre><code class="language-python">from fastapi import FastAPI

app = FastAPI()

@app.get("/upload")
async def upload(file: UploadFile = File(...)):
    return {"url": "https://..."}</code></pre>
            </div>
        </div>
        <div class="cards">
            <div class="card">
                <h3>Interactive API Docs</h3>
                <p>Explore this API's endpoints with interactive docs. Test requests and view response schemas.</p>
                <a href="/docs" target="_blank">Open Docs →</a>
            </div>
            <div class="card">
                <h3>List Files</h3>
                <p>Access blob listing via the REST API.</p>
                <a href="/api/v1/files" target="_blank">List Files →</a>
            </div>
        </div>
    </main>
    <script>hljs.highlightAll();</script>
</body>
</html>
"""

WORKER_OPENAPI = {
    "openapi": "3.0.3",
    "info": {
        "title": "NJMTECH Upload Blob API (Worker)",
        "version": "1.0.0",
        "description": "Cloudflare Worker runtime routes.",
    },
    "servers": [{"url": "/"}],
    "components": {
        "securitySchemes": {
            "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        },
        "schemas": {
            "HealthResponse": {
                "type": "object",
                "properties": {"status": {"type": "string", "example": "ok"}},
                "required": ["status"],
            },
            "RootResponse": {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "example": "Welcome to the upload blob API",
                    }
                },
                "required": ["message"],
            },
            "BlobGroup": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "example": "njmtech-blob-api/uploads"},
                    "timestamp": {
                        "type": "string",
                        "nullable": True,
                        "example": "2026-04-27T10:20:30.000Z",
                    },
                    "txt_url": {"type": "string", "nullable": True},
                    "md_url": {"type": "string", "nullable": True},
                },
                "required": ["path", "timestamp", "txt_url", "md_url"],
            },
            "ListFilesResponse": {
                "type": "object",
                "properties": {
                    "cache_bypass": {"type": "boolean", "example": False},
                    "cache_source": {
                        "type": "string",
                        "enum": ["redis", "blob"],
                        "example": "redis",
                    },
                    "count": {"type": "integer", "example": 26},
                    "data": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/BlobGroup"},
                    },
                },
                "required": ["cache_bypass", "cache_source", "count", "data"],
            },
            "UploadResponse": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "example": "https://pub-1234567890abcdef.r2.dev/file.txt",
                    },
                    "pathname": {
                        "type": "string",
                        "example": "njmtech-blob-api/uploads/file.txt",
                    },
                    "content_type": {"type": "string", "example": "text/plain"},
                    "size": {"type": "integer", "example": 128},
                },
                "required": ["url", "pathname", "content_type", "size"],
            },
            "DeleteResponse": {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "example": "Blob deleted successfully",
                    }
                },
                "required": ["message"],
            },
            "ErrorEnvelope": {
                "type": "object",
                "properties": {
                    "error": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"},
                            "title": {"type": "string"},
                            "instance": {"type": "string"},
                            "type": {"type": "string"},
                            "additional_info": {"nullable": True},
                        },
                        "required": ["detail", "title", "instance", "type"],
                    }
                },
                "required": ["error"],
            },
        },
    },
    "paths": {
        "/": {
            "get": {
                "summary": "Home page",
                "description": "Returns the landing page HTML.",
                "responses": {
                    "200": {
                        "description": "Landing page HTML",
                        "content": {"text/html": {"schema": {"type": "string"}}},
                    }
                },
            }
        },
        "/health": {
            "get": {
                "summary": "Health check",
                "responses": {
                    "200": {
                        "description": "Service is healthy",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/HealthResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/v1/": {
            "get": {
                "summary": "Root endpoint",
                "responses": {
                    "200": {
                        "description": "Worker API welcome message",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/RootResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/v1/files": {
            "get": {
                "summary": "List all files",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "no_cache",
                        "in": "query",
                        "required": False,
                        "schema": {
                            "type": "string",
                            "enum": ["1", "true", "yes", "on", "0", "false", "no", "off"],
                            "default": "false",
                        },
                        "description": "Bypass Redis cache and fetch directly from Blob.",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Grouped file listing",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ListFilesResponse"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
        "/api/v1/blob/files": {
            "get": {
                "summary": "List all files (alias)",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "no_cache",
                        "in": "query",
                        "required": False,
                        "schema": {
                            "type": "string",
                            "enum": ["1", "true", "yes", "on", "0", "false", "no", "off"],
                            "default": "false",
                        },
                        "description": "Bypass Redis cache and fetch directly from Blob.",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Grouped file listing",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ListFilesResponse"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
        "/api/v1/upload": {
            "post": {
                "summary": "Upload a file",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "blob_path",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string", "default": "uploads"},
                        "description": "Directory path in blob storage",
                    },
                    {
                        "name": "allow_overwrite",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "boolean", "default": False},
                        "description": "Allow overwriting existing files",
                    },
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "file": {
                                        "type": "string",
                                        "format": "binary",
                                        "description": "The file to upload",
                                    }
                                },
                                "required": ["file"],
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Upload succeeded",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/UploadResponse"}
                            }
                        },
                    },
                    "400": {
                        "description": "Bad request",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
        "/api/v1/blob/upload": {
            "post": {
                "summary": "Upload a file (alias)",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "blob_path",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string", "default": "uploads"},
                        "description": "Directory path in blob storage",
                    },
                    {
                        "name": "allow_overwrite",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "boolean", "default": False},
                        "description": "Allow overwriting existing files",
                    },
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "file": {
                                        "type": "string",
                                        "format": "binary",
                                        "description": "The file to upload",
                                    }
                                },
                                "required": ["file"],
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Upload succeeded",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/UploadResponse"}
                            }
                        },
                    },
                    "400": {
                        "description": "Bad request",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
        "/api/v1/delete": {
            "delete": {
                "summary": "Delete a blob",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "url",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Absolute URL of the blob to delete",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Delete succeeded",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/DeleteResponse"}
                            }
                        },
                    },
                    "400": {
                        "description": "Missing or invalid url query parameter",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
        "/api/v1/blob/delete": {
            "delete": {
                "summary": "Delete a blob (alias)",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "url",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Absolute URL of the blob to delete",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Delete succeeded",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/DeleteResponse"}
                            }
                        },
                    },
                    "400": {
                        "description": "Missing or invalid url query parameter",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "401": {
                        "description": "Unauthorized",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                    "500": {
                        "description": "Internal server error",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorEnvelope"}
                            }
                        },
                    },
                },
            }
        },
    },
}

DOCS_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true
    });
  </script>
</body>
</html>
"""


async def handle_public_routes(method, path):
    if method == "GET" and path == "/":
        return html_response(HOME_HTML)

    if method == "GET" and path == "/health":
        return json_response({"status": "ok"})

    if method == "GET" and path == "/openapi.json":
        return json_response(WORKER_OPENAPI)

    if method == "GET" and path == "/docs":
        return html_response(DOCS_HTML)

    return None
