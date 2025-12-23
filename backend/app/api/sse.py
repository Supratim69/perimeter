import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.event_generator import generate_event

router = APIRouter()

async def event_stream():
    while True:
        event = await generate_event()
        yield f"event: attack\ndata: {json.dumps(event)}\n\n"
        await asyncio.sleep(1.5)

@router.get("/events/stream")
async def stream():
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
