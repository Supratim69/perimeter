from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from app.api.sse import router as sse_router
from app.api.history import router as history_router
from app.services.historical_data import historical_store
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS]

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-populate last 7 days of historical data
    logger.info("Populating historical data for the last 7 days...")
    for days_ago in range(1, 8):  # 1 to 7 days ago
        target_date = datetime.now() - timedelta(days=days_ago)
        await historical_store.fetch_and_aggregate(target_date)
    logger.info("Historical data population complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(title="Live DDoS Map", lifespan=lifespan)

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)

app.include_router(sse_router)
app.include_router(history_router)

@app.get("/")
def health():
    return {"status": "ok", "mode": "live + historical"}