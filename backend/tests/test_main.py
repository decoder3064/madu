import json
from fastapi.testclient import TestClient
from app.main import create_app


def test_websocket_sends_initial_state_on_connect():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_text()
            payload = json.loads(data)
            assert payload == {
                "agents": [{"id": "villager-1", "x": 10, "y": 10}],
                "player": {"id": "player-1", "x": 5, "y": 5},
            }


def test_websocket_applies_valid_move_and_broadcasts_new_state():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 5, "y": 4}


def test_websocket_ignores_malformed_message_and_still_processes_next_move():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text("not valid json")
            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 5, "y": 4}
