import json
import pytest
from app.api.websocket import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent = []
        self.fail_on_send = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, data: str):
        if self.fail_on_send:
            raise RuntimeError("connection closed")
        self.sent.append(data)


@pytest.mark.asyncio
async def test_connect_accepts_and_registers_websocket():
    manager = ConnectionManager()
    ws = FakeWebSocket()

    await manager.connect(ws)

    assert ws.accepted is True
    assert ws in manager._connections


@pytest.mark.asyncio
async def test_broadcast_sends_agents_list_to_all_connected():
    manager = ConnectionManager()
    ws1, ws2 = FakeWebSocket(), FakeWebSocket()
    await manager.connect(ws1)
    await manager.connect(ws2)

    await manager.broadcast({"agents": [{"id": "a1", "x": 1, "y": 2}]})

    assert json.loads(ws1.sent[0]) == {"agents": [{"id": "a1", "x": 1, "y": 2}]}
    assert json.loads(ws2.sent[0]) == {"agents": [{"id": "a1", "x": 1, "y": 2}]}


@pytest.mark.asyncio
async def test_broadcast_drops_connection_that_fails_to_send():
    manager = ConnectionManager()
    ws1, ws2 = FakeWebSocket(), FakeWebSocket()
    ws1.fail_on_send = True
    await manager.connect(ws1)
    await manager.connect(ws2)

    await manager.broadcast({"agents": []})

    assert ws1 not in manager._connections
    assert ws2 in manager._connections


def test_disconnect_removes_websocket():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager._connections.append(ws)

    manager.disconnect(ws)

    assert ws not in manager._connections
