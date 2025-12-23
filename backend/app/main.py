from fastapi import FastAPI
from app.api.sse import router as sse_router

app = FastAPI(title="Live DDoS Map")

app.include_router(sse_router)

@app.get("/")
def health():
    return {"status": "ok"}