from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .routers import vercel_blob, home, data, cron
from .middleware.error_handling_middleware import ErrorHandlingMiddleware

app = FastAPI(
    title="NJMTECH Vercel Blob API",
    description="""
    A simple API for interacting with Vercel Blob storage.
    
    ## Authentication
    All blob-related endpoints require a Bearer Token in the `Authorization` header.
    
    ## Features
    * **List Files**: Retrieve a grouped list of all files in the storage.
    * **Upload**: Upload files directly to a specified path.
    * **Delete**: Delete blobs by their absolute path.
    """,
    version="1.0.0",
)


app.add_middleware(ErrorHandlingMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors(), "body": exc.body}),
    )


app.include_router(home.router)
app.include_router(data.router, prefix="/api/v1/demo")
app.include_router(vercel_blob.router, prefix="/api/v1/blob")
app.include_router(cron.router)
