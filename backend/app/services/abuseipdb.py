import httpx
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class AbuseIPDBClient:
    """Client for interacting with AbuseIPDB API"""
    
    def __init__(self):
        self.api_key = settings.ABUSEIPDB_API_KEY
        self.base_url = settings.ABUSEIPDB_BASE_URL
        self.headers = {
            "Key": self.api_key,
            "Accept": "application/json"
        }
    
    async def get_blacklist(self, confidence_minimum: int = 75, limit: int = 100) -> List[Dict]:
        """
        Fetch blacklisted IPs from AbuseIPDB
        
        Args:
            confidence_minimum: Minimum confidence score (0-100)
            limit: Number of results to return
        
        Returns:
            List of IP abuse data
        """
        if not self.api_key:
            logger.warning("AbuseIPDB API key not configured, returning empty list")
            return []
        
        url = f"{self.base_url}/blacklist"
        params = {
            "confidenceMinimum": confidence_minimum,
            "limit": limit
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return data.get("data", [])
        except httpx.HTTPError as e:
            logger.error(f"Error fetching AbuseIPDB blacklist: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in AbuseIPDB client: {e}")
            return []
    
    async def check_ip(self, ip_address: str, max_age_days: int = 90) -> Optional[Dict]:
        """
        Check a specific IP address
        
        Args:
            ip_address: IP to check
            max_age_days: Maximum age of reports in days
        
        Returns:
            IP abuse data or None
        """
        if not self.api_key:
            logger.warning("AbuseIPDB API key not configured")
            return None
        
        url = f"{self.base_url}/check"
        params = {
            "ipAddress": ip_address,
            "maxAgeInDays": max_age_days,
            "verbose": ""
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return data.get("data", None)
        except httpx.HTTPError as e:
            logger.error(f"Error checking IP {ip_address}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error checking IP: {e}")
            return None


# Category mapping from AbuseIPDB to our attack types
CATEGORY_MAPPING = {
    4: "ddos",           # DDoS Attack
    21: "bruteforce",    # Brute-Force
    18: "bruteforce",    # Brute-Force (SSH)
    22: "bruteforce",    # Brute-Force (Web)
    5: "bruteforce",     # FTP Brute-Force
    19: "bot",           # Bad Web Bot
    10: "bot",           # Email Spam
    11: "bot",           # Email Spam (Mail)
    14: "ddos",          # Port Scan
    15: "bot",           # Hacking
}


def map_category_to_type(categories: List[int]) -> str:
    """Map AbuseIPDB categories to our attack types"""
    for cat in categories:
        if cat in CATEGORY_MAPPING:
            return CATEGORY_MAPPING[cat]
    return "ddos"  # Default to ddos


def calculate_severity(abuse_confidence_score: int, total_reports: int) -> int:
    """
    Calculate severity (1-5) based on AbuseIPDB metrics
    
    Args:
        abuse_confidence_score: 0-100 confidence score
        total_reports: Number of reports
    
    Returns:
        Severity from 1 (low) to 5 (critical)
    """
    # Weight confidence score more heavily
    base_score = abuse_confidence_score / 100.0  # 0.0 - 1.0
    
    # Add bonus for high report count
    report_bonus = min(total_reports / 100, 0.5)  # Max 0.5 bonus
    
    combined = base_score + report_bonus
    
    # Map to 1-5 scale
    if combined >= 1.2:
        return 5
    elif combined >= 0.9:
        return 4
    elif combined >= 0.6:
        return 3
    elif combined >= 0.3:
        return 2
    else:
        return 1
