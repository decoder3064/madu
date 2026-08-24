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
