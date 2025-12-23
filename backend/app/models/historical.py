from pydantic import BaseModel
from typing import List, Dict

class HistoricalSummary(BaseModel):
    date: str  # YYYY-MM-DD format
    total_events: int
    events_by_country: Dict[str, int]
    events_by_type: Dict[str, int]
    avg_severity: float

class CountryStats(BaseModel):
    country: str
    total_events: int
    avg_severity: float
    attack_types: Dict[str, int]
