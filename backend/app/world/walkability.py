from app.world.grid import Grid
from app.world.town import TownEntity

STEPS = ((0, -1), (1, 0), (0, 1), (-1, 0))
GRASS_COST = 2.0


class WalkableMap:
    def __init__(
        self,
        grid: Grid,
        blockers: list[TownEntity],
        surfaces: list[TownEntity] = (),
    ):
        self.width = grid.width
        self.height = grid.height
        self._open = []
        self._cost = []
        for _ in range(grid.height):
            self._open.append([True] * grid.width)
            self._cost.append([GRASS_COST] * grid.width)

        for blocker in blockers:
            for y in range(blocker.y, blocker.y + blocker.height):
                for x in range(blocker.x, blocker.x + blocker.width):
                    if grid.in_bounds(x, y):
                        self._open[y][x] = False

        self.cheapest_cost = GRASS_COST
        for surface in surfaces:
            if surface.walk_cost is None:
                continue
            self.cheapest_cost = min(self.cheapest_cost, surface.walk_cost)
            for y in range(surface.y, surface.y + surface.height):
                for x in range(surface.x, surface.x + surface.width):
                    if grid.in_bounds(x, y):
                        self._cost[y][x] = surface.walk_cost

    def is_walkable(self, x: int, y: int) -> bool:
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
        return self._open[y][x]

    def step_cost(self, x: int, y: int) -> float:
        return self._cost[y][x]

    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        result = []
        for dx, dy in STEPS:
            next_x, next_y = x + dx, y + dy
            if self.is_walkable(next_x, next_y):
                result.append((next_x, next_y))
        return result
