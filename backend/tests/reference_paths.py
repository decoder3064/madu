import heapq

from app.world.pathfinding import TURN_PENALTY, Tile
from app.world.walkability import STEPS, WalkableMap


def cheapest_cost(
    walkable: WalkableMap, start: Tile, goal: Tile, turn_penalty: float = TURN_PENALTY
) -> float | None:
    if not walkable.is_walkable(*start) or not walkable.is_walkable(*goal):
        return None

    start_state = (start[0], start[1], None)
    best = {start_state: 0.0}
    queue = [(0.0, 0, start_state)]
    pushes = 1
    done = set()

    while queue:
        cost, _, state = heapq.heappop(queue)
        if state in done:
            continue
        done.add(state)
        x, y, heading = state
        if (x, y) == goal:
            return cost

        for direction, (dx, dy) in enumerate(STEPS):
            next_x, next_y = x + dx, y + dy
            if not walkable.is_walkable(next_x, next_y):
                continue
            step = walkable.step_cost(next_x, next_y)
            if heading is not None and direction != heading:
                step += turn_penalty
            next_state = (next_x, next_y, direction)
            if cost + step < best.get(next_state, float("inf")):
                best[next_state] = cost + step
                heapq.heappush(queue, (cost + step, pushes, next_state))
                pushes += 1

    return None
