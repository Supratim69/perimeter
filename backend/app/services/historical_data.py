import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict
from app.services.abuseipdb import AbuseIPDBClient, map_category_to_type, calculate_severity
from app.models.attack_event import AttackEvent, Location
from app.models.historical import HistoricalSummary, CountryStats
import logging

logger = logging.getLogger(__name__)


# Location database for countries (expanded from Phase 1)
COUNTRY_LOCATIONS = {
    "US": {"lat": 37.7749, "lng": -95.7129},
    "CN": {"lat": 35.9042, "lng": 104.1954},
    "RU": {"lat": 61.5240, "lng": 105.3188},
    "IN": {"lat": 20.5937, "lng": 78.9629},
    "BR": {"lat": -14.2350, "lng": -51.9253},
    "JP": {"lat": 36.2048, "lng": 138.2529},
    "DE": {"lat": 51.1657, "lng": 10.4515},
    "GB": {"lat": 55.3781, "lng": -3.4360},
    "FR": {"lat": 46.2276, "lng": 2.2137},
    "AU": {"lat": -25.2744, "lng": 133.7751},
    "CA": {"lat": 56.1304, "lng": -106.3468},
    "KR": {"lat": 35.9078, "lng": 127.7669},
    "IT": {"lat": 41.8719, "lng": 12.5674},
    "ES": {"lat": 40.4637, "lng": -3.7492},
    "MX": {"lat": 23.6345, "lng": -102.5528},
    "NL": {"lat": 52.1326, "lng": 5.2913},
    "SE": {"lat": 60.1282, "lng": 18.6435},
    "PL": {"lat": 51.9194, "lng": 19.1451},
    "TR": {"lat": 38.9637, "lng": 35.2433},
    "UA": {"lat": 48.3794, "lng": 31.1656},
}


class HistoricalDataStore:
    """In-memory storage for historical attack data"""
    
    def __init__(self):
        # Structure: {date_str: [AttackEvent, ...]}
        self.events_by_date: Dict[str, List[Dict]] = {}
        self.abuseipdb_client = AbuseIPDBClient()
        self._lock = asyncio.Lock()
    
    async def fetch_and_aggregate(self, target_date: Optional[datetime] = None) -> None:
        """
        Fetch data from AbuseIPDB and aggregate for a specific date
        
        Args:
            target_date: Date to fetch data for (defaults to yesterday)
        """
        if target_date is None:
            target_date = datetime.now() - timedelta(days=1)
        
        date_str = target_date.strftime("%Y-%m-%d")
        
        logger.info(f"Fetching historical data for {date_str}")
        
        # Fetch blacklist data
        blacklist_data = await self.abuseipdb_client.get_blacklist(
            confidence_minimum=50,
            limit=100
        )
        
        if not blacklist_data:
            # If no API key or error, generate synthetic historical data
            logger.warning(f"No AbuseIPDB data available, generating synthetic data for {date_str}")
            await self._generate_synthetic_data(date_str)
            return
        
        # Transform AbuseIPDB data to attack events
        events = []
        for item in blacklist_data:
            country_code = item.get("countryCode", "US")
            if country_code not in COUNTRY_LOCATIONS:
                country_code = "US"  # Default to US if unknown
            
            # Create source location
            source_location = COUNTRY_LOCATIONS[country_code]
            
            # Random target (different from source)
            target_countries = [c for c in COUNTRY_LOCATIONS.keys() if c != country_code]
            target_country = random.choice(target_countries)
            target_location = COUNTRY_LOCATIONS[target_country]
            
            # Map categories to attack type
            categories = item.get("categories", [])
            attack_type = map_category_to_type(categories) if categories else "ddos"
            
            # Calculate severity
            confidence_score = item.get("abuseConfidenceScore", 50)
            total_reports = item.get("totalReports", 1)
            severity = calculate_severity(confidence_score, total_reports)
            
            # Create event
            event = {
                "id": str(uuid.uuid4()),
                "source": {
                    "country": country_code,
                    "lat": source_location["lat"] + random.uniform(-2, 2),
                    "lng": source_location["lng"] + random.uniform(-2, 2),
                },
                "target": {
                    "country": target_country,
                    "lat": target_location["lat"] + random.uniform(-2, 2),
                    "lng": target_location["lng"] + random.uniform(-2, 2),
                },
                "type": attack_type,
                "severity": severity,
                "confidence": confidence_score / 100.0,
                "timestamp": int(target_date.timestamp() * 1000),
            }
            events.append(event)
        
        async with self._lock:
            self.events_by_date[date_str] = events
        
        logger.info(f"Stored {len(events)} events for {date_str}")
    
    async def _generate_synthetic_data(self, date_str: str) -> None:
        """Generate synthetic historical data when API is unavailable"""
        events = []
        num_events = random.randint(30, 80)
        
        for _ in range(num_events):
            source_country = random.choice(list(COUNTRY_LOCATIONS.keys()))
            target_country = random.choice([c for c in COUNTRY_LOCATIONS.keys() if c != source_country])
            
            source_location = COUNTRY_LOCATIONS[source_country]
            target_location = COUNTRY_LOCATIONS[target_country]
            
            event = {
                "id": str(uuid.uuid4()),
                "source": {
                    "country": source_country,
                    "lat": source_location["lat"] + random.uniform(-2, 2),
                    "lng": source_location["lng"] + random.uniform(-2, 2),
                },
                "target": {
                    "country": target_country,
                    "lat": target_location["lat"] + random.uniform(-2, 2),
                    "lng": target_location["lng"] + random.uniform(-2, 2),
                },
                "type": random.choice(["ddos", "bot", "bruteforce"]),
                "severity": random.randint(1, 5),
                "confidence": random.uniform(0.5, 1.0),
                "timestamp": int(datetime.strptime(date_str, "%Y-%m-%d").timestamp() * 1000),
            }
            events.append(event)
        
        async with self._lock:
            self.events_by_date[date_str] = events
    
    def get_available_dates(self) -> List[str]:
        """Get list of dates with available data"""
        return sorted(self.events_by_date.keys(), reverse=True)
    
    def get_events_for_date(self, date_str: str) -> List[Dict]:
        """Get all events for a specific date"""
        return self.events_by_date.get(date_str, [])
    
    def get_summary_for_date(self, date_str: str) -> Optional[HistoricalSummary]:
        """Get aggregated summary for a date"""
        events = self.get_events_for_date(date_str)
        if not events:
            return None
        
        events_by_country = defaultdict(int)
        events_by_type = defaultdict(int)
        total_severity = 0
        
        for event in events:
            events_by_country[event["source"]["country"]] += 1
            events_by_type[event["type"]] += 1
            total_severity += event["severity"]
        
        return HistoricalSummary(
            date=date_str,
            total_events=len(events),
            events_by_country=dict(events_by_country),
            events_by_type=dict(events_by_type),
            avg_severity=total_severity / len(events) if events else 0
        )
    
    def get_country_stats(self, date_str: str) -> List[CountryStats]:
        """Get per-country statistics for a date"""
        events = self.get_events_for_date(date_str)
        if not events:
            return []
        
        country_data = defaultdict(lambda: {"count": 0, "severity_sum": 0, "types": defaultdict(int)})
        
        for event in events:
            country = event["source"]["country"]
            country_data[country]["count"] += 1
            country_data[country]["severity_sum"] += event["severity"]
            country_data[country]["types"][event["type"]] += 1
        
        stats = []
        for country, data in country_data.items():
            stats.append(CountryStats(
                country=country,
                total_events=data["count"],
                avg_severity=data["severity_sum"] / data["count"],
                attack_types=dict(data["types"])
            ))
        
        return sorted(stats, key=lambda x: x.total_events, reverse=True)


# Global instance
historical_store = HistoricalDataStore()
