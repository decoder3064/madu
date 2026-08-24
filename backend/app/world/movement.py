from app.world.grid import Grid

DIRECTIONS = {
    "up": (0, -1),
    "right": (1, 0),
    "down": (0, 1),
    "left": (-1, 0),
}


def apply_move(grid: Grid, x: int, y: int, direction: str) -> tuple[int, int]:
    dx, dy = DIRECTIONS[direction]
    new_x, new_y = x + dx, y + dy
    if grid.in_bounds(new_x, new_y):
        return new_x, new_y
    return x, y
