from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.sse import router as sse_router

app = FastAPI(title="Live DDoS Map")

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sse_router)

@app.get("/")
def health():
    return {"status": "ok"}