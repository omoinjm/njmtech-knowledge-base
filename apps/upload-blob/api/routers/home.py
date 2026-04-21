from fastapi import APIRouter
from fastapi.responses import JSONResponse, HTMLResponse

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health check")
async def health_check():
    """Checks if the service is up and running."""
    return JSONResponse(status_code=200, content={"status": "ok"})


@router.get("/", response_class=HTMLResponse, summary="Home page")
def read_root():
    """Returns the landing page HTML."""
    return """
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
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                background-color: #000000;
                color: #ffffff;
                line-height: 1.6;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            header {
                border-bottom: 1px solid #333333;
                padding: 0;
            }
            
            nav {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                padding: 1rem 2rem;
                gap: 2rem;
            }
            
            .logo {
                font-size: 1.25rem;
                font-weight: 600;
                color: #ffffff;
                text-decoration: none;
            }

            .logo img {
                width: 150px;
                height: auto;
                max-width: 100%;
            }
            
            .nav-links {
                display: flex;
                gap: 1.5rem;
                margin-left: auto;
            }
            
            .nav-links a {
                text-decoration: none;
                color: #888888;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                transition: all 0.2s ease;
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .nav-links a:hover {
                color: #ffffff;
                background-color: #111111;
            }
            
            main {
                flex: 1;
                max-width: 1200px;
                margin: 0 auto;
                padding: 4rem 2rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
            }
            
            .hero {
                margin-bottom: 3rem;
            }
            
            .hero-code {
                margin-top: 2rem;
                width: 100%;
                max-width: 900px;
            }
            
            .hero-code pre {
                background-color: #0a0a0a;
                border: 1px solid #333333;
                border-radius: 8px;
                padding: 1.5rem;
                text-align: left;
                margin: 0;
                overflow-x: auto;
            }
            
            .hero-code code {
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: clamp(0.75rem, 1.5vw, 0.85rem);
                line-height: 1.5;
                display: block;
                white-space: pre;
            }
            
            h1 {
                font-size: clamp(2rem, 5vw, 3rem);
                font-weight: 700;
                margin-bottom: 1rem;
                background: linear-gradient(to right, #ffffff, #888888);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .subtitle {
                font-size: 1.25rem;
                color: #888888;
                margin-bottom: 2rem;
                max-width: 600px;
            }
            
            .cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                width: 100%;
                max-width: 900px;
            }
            
            .card {
                background-color: #111111;
                border: 1px solid #333333;
                border-radius: 8px;
                padding: 1.5rem;
                transition: all 0.2s ease;
                text-align: left;
            }
            
            .card:hover {
                border-color: #555555;
                transform: translateY(-2px);
            }
            
            .card h3 {
                font-size: 1.125rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: #ffffff;
            }
            
            .card p {
                color: #888888;
                font-size: 0.875rem;
                margin-bottom: 1rem;
            }
            
            .card a {
                display: inline-flex;
                align-items.center;
                color: #ffffff;
                text-decoration: none;
                font-size: 0.875rem;
                font-weight: 500;
                padding: 0.5rem 1rem;
                background-color: #222222;
                border-radius: 6px;
                border: 1px solid #333333;
                transition: all 0.2s ease;
            }
            
            .card a:hover {
                background-color: #333333;
                border-color: #555555;
            }
            
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background-color: #0070f3;
                color: #ffffff;
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 500;
                margin-bottom: 2rem;
            }
            
            .status-dot {
                width: 6px;
                height: 6px;
                background-color: #00ff88;
                border-radius: 50%;
            }
            
            @media (max-width: 768px) {
                nav {
                    padding: 1rem;
                    flex-direction: column;
                    gap: 1rem;
                    align-items: flex-start;
                }
                
                .logo img {
                    width: 120px;
                }
                
                .nav-links {
                    margin-left: 0;
                    flex-wrap: wrap;
                    width: 100%;
                }
                
                main {
                    padding: 2rem 1rem;
                }
                
                .hero-code {
                    margin-top: 1.5rem;
                }
                
                .hero-code pre {
                    padding: 1rem;
                    border-radius: 6px;
                }
                
                .cards {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                
                .card {
                    padding: 1.25rem;
                }
            }
            
            @media (max-width: 480px) {
                nav {
                    padding: 0.75rem;
                }
                
                .logo img {
                    width: 100px;
                }
                
                .nav-links a {
                    padding: 0.4rem 0.75rem;
                    font-size: 0.8rem;
                }
                
                main {
                    padding: 1.5rem 0.75rem;
                }
                
                .hero-code pre {
                    padding: 0.75rem;
                }
                
                .subtitle {
                    font-size: 1rem;
                }
            }
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
                    <p>Explore this API's endpoints with the interactive Swagger UI. Test requests and view response schemas in real-time.</p>
                    <a href="/docs" target="_blank">Open Swagger UI →</a>
                </div>
                
                <div class="card">
                    <h3>File Upload</h3>
                    <p>Access the file upload functionality through our REST API. Perfect for testing and development purposes.</p>
                    <a href="/api/v1/demo/data" target="_blank">Get Data →</a>
                </div>
                
            </div>
        </main>
        <script>
            hljs.highlightAll();
        </script>
    </body>
    </html>
    """
