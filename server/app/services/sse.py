"""In-process SSE broker.

Single-process (one uvicorn worker), so a plain in-memory dict of asyncio
Queues is sufficient. Every subscriber receives every event published to the
`alertes` channel or their own per-user channel.

If a consumer queue is full the event is dropped for that consumer (the
office screen will catch up on reconnect via GET /alertes).
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any


class EventBroker:
    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[str]] = []

    def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=64)
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        try:
            self._queues.remove(q)
        except ValueError:
            pass

    def publish(self, event: str, data: dict[str, Any]) -> None:
        payload = f"event: {event}\ndata: {json.dumps(data)}\n\n"
        for q in self._queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass  # slow consumer — drop; client reconnects and fetches state

    async def stream(self, q: asyncio.Queue[str]) -> AsyncGenerator[str, None]:
        """Yield SSE frames; send heartbeat comments every 15 s to keep the TCP
        connection alive through proxies."""
        try:
            yield ": connected\n\n"
            while True:
                try:
                    frame = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield frame
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            self.unsubscribe(q)


broker = EventBroker()
