import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # AlienVault OTX API settings
    OTX_API_KEY: str = os.getenv("OTX_API_KEY", "")
    OTX_BASE_URL: str = "https://otx.alienvault.com/api/v1"
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Data settings
    MAX_HISTORICAL_DAYS: int = 90  # Store last 90 days of data
    AGGREGATION_INTERVAL_HOURS: int = 24  # Aggregate daily
    OTX_CACHE_TTL: int = 3600  # Cache OTX data for 1 hour
    OTX_MAX_PULSES: int = 50  # Max pulses to fetch per request
    
settings = Settings()
