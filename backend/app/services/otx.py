import httpx
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class OTXClient:
    """Client for interacting with AlienVault OTX API"""
    
    def __init__(self):
        self.api_key = settings.OTX_API_KEY
        self.base_url = settings.OTX_BASE_URL
        self.headers = {
            "X-OTX-API-KEY": self.api_key,
            "Accept": "application/json"
        }
        self._pulse_cache: Dict[str, Dict] = {}  # Cache pulses by ID
        self._cache_timestamps: Dict[str, datetime] = {}
    
    def _is_cache_valid(self, pulse_id: str) -> bool:
        """Check if cached pulse is still valid"""
        if pulse_id not in self._cache_timestamps:
            return False
        cache_time = self._cache_timestamps[pulse_id]
        return (datetime.now() - cache_time).seconds < settings.OTX_CACHE_TTL
    
    async def get_pulses_subscribed(self, limit: int = 50, modified_since: Optional[str] = None) -> List[Dict]:
        """
        Fetch pulses from subscribed sources
        
        Args:
            limit: Maximum number of pulses to return
            modified_since: ISO timestamp to fetch pulses modified after this time
        
        Returns:
            List of pulse data
        """
        if not self.api_key:
            logger.warning("OTX API key not configured, returning empty list")
            return []
        
        url = f"{self.base_url}/pulses/subscribed"
        params = {"limit": min(limit, settings.OTX_MAX_PULSES)}
        
        if modified_since:
            params["modified_since"] = modified_since
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                
                pulses = data.get("results", [])
                
                # Cache pulses
                for pulse in pulses:
                    pulse_id = pulse.get("id")
                    if pulse_id:
                        self._pulse_cache[pulse_id] = pulse
                        self._cache_timestamps[pulse_id] = datetime.now()
                
                return pulses
        except httpx.HTTPError as e:
            logger.error(f"Error fetching OTX pulses: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in OTX client: {e}")
            return []
    
    async def get_pulse_indicators(self, pulse_id: str) -> List[Dict]:
        """
        Fetch indicators for a specific pulse
        
        Args:
            pulse_id: The pulse ID
        
        Returns:
            List of indicators
        """
        if not self.api_key:
            logger.warning("OTX API key not configured")
            return []
        
        url = f"{self.base_url}/pulses/{pulse_id}/indicators"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                return data.get("results", [])
        except httpx.HTTPError as e:
            logger.error(f"Error fetching indicators for pulse {pulse_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching indicators: {e}")
            return []
    
    async def get_pulse_by_id(self, pulse_id: str) -> Optional[Dict]:
        """
        Get a specific pulse by ID (with caching)
        
        Args:
            pulse_id: The pulse ID
        
        Returns:
            Pulse data or None
        """
        # Check cache first
        if self._is_cache_valid(pulse_id):
            logger.debug(f"Returning cached pulse {pulse_id}")
            return self._pulse_cache.get(pulse_id)
        
        if not self.api_key:
            logger.warning("OTX API key not configured")
            return None
        
        url = f"{self.base_url}/pulses/{pulse_id}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                pulse = response.json()
                
                # Cache it
                self._pulse_cache[pulse_id] = pulse
                self._cache_timestamps[pulse_id] = datetime.now()
                
                return pulse
        except httpx.HTTPError as e:
            logger.error(f"Error fetching pulse {pulse_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching pulse: {e}")
            return None


# Tag-based attack type mapping
TAG_TO_ATTACK_TYPE = {
    "ddos": "ddos",
    "dos": "ddos",
    "botnet": "bot",
    "bot": "bot",
    "malware": "bot",
    "bruteforce": "bruteforce",
    "brute-force": "bruteforce",
    "ssh": "bruteforce",
    "ftp": "bruteforce",
    "rdp": "bruteforce",
    "scan": "ddos",
    "exploit": "bot",
}


def map_tags_to_attack_type(tags: List[str]) -> str:
    """Map OTX pulse tags to our attack types"""
    if not tags:
        return "ddos"
    
    # Check each tag against our mapping
    tags_lower = [tag.lower() for tag in tags]
    for tag in tags_lower:
        if tag in TAG_TO_ATTACK_TYPE:
            return TAG_TO_ATTACK_TYPE[tag]
    
    # Default based on common patterns
    for tag in tags_lower:
        if "ddos" in tag or "flood" in tag or "amplification" in tag:
            return "ddos"
        if "brute" in tag or "password" in tag or "login" in tag:
            return "bruteforce"
        if "bot" in tag or "trojan" in tag or "rat" in tag:
            return "bot"
    
    return "ddos"  # Default


def calculate_severity_from_pulse(pulse: Dict) -> int:
    """
    Calculate severity (1-5) based on pulse metadata
    
    Args:
        pulse: Pulse data from OTX
    
    Returns:
        Severity from 1 (low) to 5 (critical)
    """
    # Factors: TLP, indicator count, tags
    tlp = pulse.get("tlp", "white").lower()
    indicator_count = len(pulse.get("indicators", []))
    tags = pulse.get("tags", [])
    
    # Base severity from TLP
    tlp_scores = {
        "red": 5,      # Critical
        "amber": 4,    # High
        "green": 3,    # Medium
        "white": 2,    # Low
    }
    base_severity = tlp_scores.get(tlp, 2)
    
    # Boost for high indicator count
    if indicator_count > 100:
        base_severity = min(5, base_severity + 1)
    elif indicator_count > 50:
        base_severity = min(5, base_severity + 0.5)
    
    # Boost for critical tags
    critical_tags = ["apt", "critical", "high", "severe", "targeted"]
    if any(tag.lower() in critical_tags for tag in tags):
        base_severity = min(5, base_severity + 1)
    
    return max(1, min(5, int(base_severity)))


def extract_confidence_from_pulse(pulse: Dict) -> float:
    """
    Extract confidence score (0-1) from pulse
    
    Args:
        pulse: Pulse data from OTX
    
    Returns:
        Confidence from 0.0 to 1.0
    """
    # OTX doesn't provide explicit confidence, so we derive it
    tlp = pulse.get("tlp", "white").lower()
    indicator_count = len(pulse.get("indicators", []))
    
    # Base confidence from TLP
    tlp_confidence = {
        "red": 0.9,
        "amber": 0.8,
        "green": 0.7,
        "white": 0.6,
    }
    base_confidence = tlp_confidence.get(tlp, 0.6)
    
    # Adjust based on indicator count
    if indicator_count > 50:
        base_confidence = min(1.0, base_confidence + 0.1)
    elif indicator_count < 5:
        base_confidence = max(0.5, base_confidence - 0.1)
    
    return round(base_confidence, 2)
