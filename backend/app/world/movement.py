from app.world.grid import Grid
from app.world.building import Building
from app.world.collision import is_blocked

DIRECTIONS = {
    "up": (0, -1),
    "right": (1, 0),
    "down": (0, 1),
    "left": (-1, 0),
}


def apply_move(
    grid: Grid,
    x: int,
    y: int,
    direction: str,
    buildings: list[Building],
    hitboxes_enabled: bool,
) -> tuple[int, int]:
    dx, dy = DIRECTIONS[direction]
    new_x, new_y = x + dx, y + dy
    if not grid.in_bounds(new_x, new_y):
        return x, y
    if hitboxes_enabled and is_blocked(new_x, new_y, buildings):
        return x, y
    return new_x, new_y
