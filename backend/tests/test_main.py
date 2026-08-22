import json
from fastapi.testclient import TestClient
from app.main import app


def test_websocket_sends_initial_agents_on_connect():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_text()
            payload = json.loads(data)
            assert payload == {"agents": [{"id": "villager-1", "x": 10, "y": 10}]}
