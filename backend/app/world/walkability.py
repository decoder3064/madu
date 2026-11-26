from app.world.grid import Grid
from app.world.town import TownEntity

STEPS = ((0, -1), (1, 0), (0, 1), (-1, 0))


class WalkableMap:
    def __init__(self, grid: Grid, blockers: list[TownEntity]):
        self.width = grid.width
        self.height = grid.height
        self._open = []
        for _ in range(grid.height):
            self._open.append([True] * grid.width)

        for blocker in blockers:
            for y in range(blocker.y, blocker.y + blocker.height):
                for x in range(blocker.x, blocker.x + blocker.width):
                    if grid.in_bounds(x, y):
                        self._open[y][x] = False

    def is_walkable(self, x: int, y: int) -> bool:
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
        return self._open[y][x]

    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        result = []
        for dx, dy in STEPS:
            next_x, next_y = x + dx, y + dy
            if self.is_walkable(next_x, next_y):
                result.append((next_x, next_y))
        return result
