import json
from fastapi.testclient import TestClient
from app.main import create_app


def test_websocket_sends_initial_state_on_connect():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            payload = json.loads(websocket.receive_text())

            assert payload["grid_width"] == 100
            assert payload["grid_height"] == 100
            assert payload["talk_range_tiles"] == 3
            assert payload["player"] == {"id": "player-1", "x": 58, "y": 55}
            assert payload["agents"][0] == {
                "id": "villager-1",
                "x": 45,
                "y": 80,
                "name": "Mira",
                "role": "Fisherwoman",
                "line": "The tide's been good to us this week.",
            }

            town_by_id = {entity["id"]: entity for entity in payload["town"]}
            assert len(town_by_id) == 16
            assert town_by_id["kai-house"]["blocks"] is True
            assert town_by_id["plaza"]["blocks"] is False
            assert "buildings" not in payload


def test_websocket_applies_valid_move_and_broadcasts_new_state():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 58, "y": 54}
            assert "town" not in payload
            assert "talk_range_tiles" not in payload
            assert payload["agents"][0] == {"id": "villager-1", "x": 45, "y": 80}


def test_websocket_ignores_malformed_message_and_still_processes_next_move():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text("not valid json")
            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 58, "y": 54}
