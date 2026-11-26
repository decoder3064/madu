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


def _tomas_x(payload):
    for agent in payload["agents"]:
        if agent["id"] == "villager-2":
            return agent["x"]


def test_go_to_sends_tomas_west_toward_bens_house():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore
            websocket.send_text(
                json.dumps({"type": "go_to", "villager_id": "villager-2", "place_id": "ben-house"})
            )
            latest = None
            for _ in range(3):
                latest = json.loads(websocket.receive_text())
            assert _tomas_x(latest) < 60


def test_go_to_with_unknown_names_is_ignored_and_moves_still_work():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore
            websocket.send_text(
                json.dumps({"type": "go_to", "villager_id": "nobody", "place_id": "nowhere"})
            )
            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            payload = json.loads(websocket.receive_text())
            assert payload["player"] == {"id": "player-1", "x": 58, "y": 54}


def test_go_to_broadcasts_the_route_ending_beside_bens_house():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore
            websocket.send_text(
                json.dumps({"type": "go_to", "villager_id": "villager-2", "place_id": "ben-house"})
            )
            route = None
            for _ in range(3):
                payload = json.loads(websocket.receive_text())
                route = payload["routes"].get("villager-2")
                if route:
                    break
            assert route is not None
            assert route[-1][0] == 34
