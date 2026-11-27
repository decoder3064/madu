import heapq
from dataclasses import dataclass
from itertools import count

from app.world.walkability import STEPS, WalkableMap

DEFAULT_WEIGHT = 1.3
TURN_PENALTY = 0.5

Tile = tuple[int, int]


@dataclass
class Route:
    tiles: list[Tile]
    cost: float
    explored: int


def find_path(
    walkable: WalkableMap,
    start: Tile,
    goal: Tile,
    weight: float = DEFAULT_WEIGHT,
    turn_penalty: float = TURN_PENALTY,
) -> Route | None:
    if not walkable.is_walkable(*start) or not walkable.is_walkable(*goal):
        return None

    def guess(x: int, y: int) -> float:
        return (abs(x - goal[0]) + abs(y - goal[1])) * walkable.cheapest_cost

    # A state is a tile plus the direction we arrived in, so turns can be priced.
    start_state = (start[0], start[1], None)
    best_cost = {start_state: 0.0}
    came_from = {}
    closed = set()
    tiebreak = count()
    frontier = [(weight * guess(*start), next(tiebreak), start_state)]

    while frontier:
        _, _, state = heapq.heappop(frontier)
        if state in closed:
            continue
        closed.add(state)

        x, y, heading = state
        if (x, y) == goal:
            return Route(_rebuild(came_from, state), best_cost[state], len(closed))

        for direction, (dx, dy) in enumerate(STEPS):
            next_x, next_y = x + dx, y + dy
            if not walkable.is_walkable(next_x, next_y):
                continue
            step = walkable.step_cost(next_x, next_y)
            if heading is not None and direction != heading:
                step += turn_penalty
            next_state = (next_x, next_y, direction)
            new_cost = best_cost[state] + step
            if new_cost < best_cost.get(next_state, float("inf")):
                best_cost[next_state] = new_cost
                came_from[next_state] = state
                priority = new_cost + weight * guess(next_x, next_y)
                heapq.heappush(frontier, (priority, next(tiebreak), next_state))

    return None


def _rebuild(came_from: dict, state: tuple) -> list[Tile]:
    tiles = []
    while state is not None:
        tiles.append((state[0], state[1]))
        state = came_from.get(state)
    tiles.reverse()
    return tiles
