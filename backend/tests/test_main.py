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
                "agents": [
                    {
                        "id": "villager-1",
                        "x": 10,
                        "y": 10,
                        "name": "Mira",
                        "role": "Fisherwoman",
                        "line": "The tide's been good to us this week.",
                    },
                    {
                        "id": "villager-2",
                        "x": 25,
                        "y": 10,
                        "name": "Tomas",
                        "role": "Baker",
                        "line": "Fresh bread every morning — come by before it's gone.",
                    },
                    {
                        "id": "villager-3",
                        "x": 17,
                        "y": 25,
                        "name": "Elena",
                        "role": "Merchant",
                        "line": "Business is slow, but the view of the harbor makes up for it.",
                    },
                ],
                "player": {"id": "player-1", "x": 5, "y": 5},
                "buildings": [
                    {"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5},
                    {"id": "building-2", "x": 35, "y": 35, "width": 5, "height": 5},
                ],
                "grid_width": 50,
                "grid_height": 50,
                "talk_range_tiles": 3,
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
            assert "buildings" not in payload
            assert "talk_range_tiles" not in payload
            assert payload["agents"][0] == {"id": "villager-1", "x": 10, "y": 10}


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
