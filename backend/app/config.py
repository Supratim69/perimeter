import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # AbuseIPDB API settings
    ABUSEIPDB_API_KEY: str = os.getenv("ABUSEIPDB_API_KEY", "")
    ABUSEIPDB_BASE_URL: str = "https://api.abuseipdb.com/api/v2"
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Data settings
    MAX_HISTORICAL_DAYS: int = 90  # Store last 90 days of data
    AGGREGATION_INTERVAL_HOURS: int = 24  # Aggregate daily
    
settings = Settings()
