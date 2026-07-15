"""Realtime Engine — WebSocket manager for live notifications, chat, and updates."""
import json
import logging
import asyncio
from typing import Dict, Set, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException

from core.deps import decode_token, db

router = APIRouter(tags=["realtime"])
logger = logging.getLogger("amora.realtime")


class ConnectionManager:
    """Tracks active WebSocket connections per user_id.
    Supports multiple concurrent tabs/devices per user."""

    def __init__(self):
        self._active: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._active.setdefault(user_id, set()).add(ws)
        logger.info(f"WS connected: {user_id} ({len(self._active[user_id])} total)")

    async def disconnect(self, user_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._active.get(user_id)
            if conns:
                conns.discard(ws)
                if not conns:
                    del self._active[user_id]

    async def send_to_user(self, user_id: str, event: str, data: Any):
        conns = self._active.get(user_id)
        if not conns:
            return 0
        message = json.dumps({"event": event, "data": data}, ensure_ascii=False, default=str)
        dead = set()
        for ws in list(conns):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        # cleanup dead sockets
        if dead:
            async with self._lock:
                cur = self._active.get(user_id, set())
                cur -= dead
                if not cur:
                    self._active.pop(user_id, None)
        return len(conns) - len(dead)

    async def broadcast_to_users(self, user_ids, event: str, data: Any):
        for uid in user_ids:
            await self.send_to_user(uid, event, data)

    def online_count(self) -> int:
        return sum(len(v) for v in self._active.values())

    def is_online(self, user_id: str) -> bool:
        return user_id in self._active and len(self._active[user_id]) > 0


# Global instance
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    # Authenticate via JWT token as query param
    try:
        payload = decode_token(token)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            await ws.close(code=1008)
            return
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1})
        if not user:
            await ws.close(code=1008)
            return
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        await ws.close(code=1008)
        return

    await manager.connect(user_id, ws)
    try:
        # Send welcome + online snapshot
        await ws.send_text(json.dumps({"event": "connected", "data": {"user_id": user_id, "online": manager.online_count()}}))
        while True:
            msg = await ws.receive_text()
            try:
                data = json.loads(msg)
                # Client-side events (ping / typing / mark_read)
                if data.get("event") == "ping":
                    await ws.send_text(json.dumps({"event": "pong", "data": {"ts": data.get("data", {}).get("ts")}}))
                elif data.get("event") == "typing":
                    target = data.get("data", {}).get("to")
                    if target:
                        await manager.send_to_user(target, "typing", {"from": user_id})
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, ws)


@router.get("/realtime/status")
async def realtime_status():
    return {"online_users": manager.online_count()}
