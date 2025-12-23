from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from app.services.historical_data import historical_store
from app.models.historical import HistoricalSummary, CountryStats

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/dates")
async def get_available_dates() -> List[str]:
    """
    Get list of dates with available historical data
    
    Returns:
        List of date strings in YYYY-MM-DD format, sorted descending
    """
    dates = historical_store.get_available_dates()
    return dates


@router.get("/summary")
async def get_summary(date: str = Query(..., description="Date in YYYY-MM-DD format")) -> HistoricalSummary:
    """
    Get aggregated summary for a specific date
    
    Args:
        date: Date string in YYYY-MM-DD format
    
    Returns:
        Historical summary with totals and breakdowns
    """
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if we have data for this date, if not try to fetch it
    if date not in historical_store.events_by_date:
        target_date = datetime.strptime(date, "%Y-%m-%d")
        await historical_store.fetch_and_aggregate(target_date)
    
    summary = historical_store.get_summary_for_date(date)
    if not summary:
        raise HTTPException(status_code=404, detail=f"No data available for {date}")
    
    return summary


@router.get("/countries")
async def get_country_stats(date: str = Query(..., description="Date in YYYY-MM-DD format")) -> List[CountryStats]:
    """
    Get per-country statistics for a specific date
    
    Args:
        date: Date string in YYYY-MM-DD format
    
    Returns:
        List of country statistics
    """
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if we have data for this date
    if date not in historical_store.events_by_date:
        target_date = datetime.strptime(date, "%Y-%m-%d")
        await historical_store.fetch_and_aggregate(target_date)
    
    stats = historical_store.get_country_stats(date)
    if not stats:
        raise HTTPException(status_code=404, detail=f"No data available for {date}")
    
    return stats


@router.get("/events")
async def get_events(date: str = Query(..., description="Date in YYYY-MM-DD format")) -> List[dict]:
    """
    Get all attack events for a specific date
    
    Args:
        date: Date string in YYYY-MM-DD format
    
    Returns:
        List of attack events for the specified date
    """
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if we have data for this date
    if date not in historical_store.events_by_date:
        target_date = datetime.strptime(date, "%Y-%m-%d")
        await historical_store.fetch_and_aggregate(target_date)
    
    events = historical_store.get_events_for_date(date)
    if not events:
        raise HTTPException(status_code=404, detail=f"No data available for {date}")
    
    return events


@router.post("/fetch/{date}")
async def fetch_data_for_date(date: str) -> dict:
    """
    Manually trigger data fetch for a specific date
    
    Args:
        date: Date string in YYYY-MM-DD format
    
    Returns:
        Status message
    """
    # Validate date format
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Don't allow fetching future dates
    if target_date > datetime.now():
        raise HTTPException(status_code=400, detail="Cannot fetch data for future dates")
    
    await historical_store.fetch_and_aggregate(target_date)
    
    events = historical_store.get_events_for_date(date)
    return {
        "status": "success",
        "date": date,
        "events_fetched": len(events)
    }
