from pydantic import BaseModel

class Location(BaseModel):
    country: str
    lat: float
    lng: float

class AttackEvent(BaseModel):
    id: str
    source: Location
    target: Location
    type: str
    severity: int
    confidence: float
    timestamp: int
