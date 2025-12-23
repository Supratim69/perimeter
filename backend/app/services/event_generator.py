import random
import uuid
import time
from app.models.attack_event import AttackEvent, Location


# Sample locations for generating random attacks
LOCATIONS = [
    {"country": "US", "lat": 37.7749, "lng": -122.4194},
    {"country": "CN", "lat": 39.9042, "lng": 116.4074},
    {"country": "RU", "lat": 55.7558, "lng": 37.6173},
    {"country": "IN", "lat": 28.7041, "lng": 77.1025},
    {"country": "BR", "lat": -23.5505, "lng": -46.6333},
    {"country": "JP", "lat": 35.6762, "lng": 139.6503},
    {"country": "DE", "lat": 52.5200, "lng": 13.4050},
    {"country": "UK", "lat": 51.5074, "lng": -0.1278},
    {"country": "FR", "lat": 48.8566, "lng": 2.3522},
    {"country": "AU", "lat": -33.8688, "lng": 151.2093},
]

ATTACK_TYPES = [
    "ddos",
    "bot",
    "bruteforce",
]


async def generate_event() -> dict:
    """Generate a random attack event."""
    source = random.choice(LOCATIONS)
    target = random.choice(LOCATIONS)
    
    # Ensure source and target are different
    while source["country"] == target["country"]:
        target = random.choice(LOCATIONS)
    
    # Normalize severity to 1-5 range
    raw_severity = random.randint(1, 10)
    severity = min(5, max(1, (raw_severity + 1) // 2))
    
    event = AttackEvent(
        id=str(uuid.uuid4()),
        source=Location(
            country=source["country"],
            lat=source["lat"] + random.uniform(-1, 1),
            lng=source["lng"] + random.uniform(-1, 1),
        ),
        target=Location(
            country=target["country"],
            lat=target["lat"] + random.uniform(-1, 1),
            lng=target["lng"] + random.uniform(-1, 1),
        ),
        type=random.choice(ATTACK_TYPES),
        severity=severity,
        confidence=random.uniform(0.5, 1.0),
        timestamp=int(time.time() * 1000),
    )
    
    return event.model_dump()
