import json

VALID_DIRECTIONS = {"up", "down", "left", "right"}


def parse_move_command(raw: str) -> str | None:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(data, dict):
        return None

    if data.get("type") != "move":
        return None

    direction = data.get("direction")
    if not isinstance(direction, str) or direction not in VALID_DIRECTIONS:
        return None

    return direction


def parse_go_to_command(raw: str) -> tuple[str, str] | None:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(data, dict) or data.get("type") != "go_to":
        return None

    villager_id = data.get("villager_id")
    place_id = data.get("place_id")
    if not isinstance(villager_id, str) or not isinstance(place_id, str):
        return None

    return villager_id, place_id
