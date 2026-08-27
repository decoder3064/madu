import random

from app.persistence.store import Store
from app.world.agent import Agent
from app.world.grid import Grid
from app.world.collision import is_blocked
from app.core.config import (
    TICK_INTERVAL_SECONDS,
    WALK_DURATION_SECONDS_MIN,
    WALK_DURATION_SECONDS_MAX,
    REST_DURATION_SECONDS_MIN,
    REST_DURATION_SECONDS_MAX,
)

# up, right, down, left
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]


def _ticks(seconds: float) -> int:
    return max(1, round(seconds / TICK_INTERVAL_SECONDS))


class Simulation:
    def __init__(self, store: Store, hitboxes_enabled: bool):
        self._store = store
        self._hitboxes_enabled = hitboxes_enabled
        self._direction_index = {agent.id: 0 for agent in store.get_agents()}
        self._walking = {agent.id: True for agent in store.get_agents()}
        self._ticks_remaining = {
            agent.id: random.randint(
                _ticks(WALK_DURATION_SECONDS_MIN), _ticks(WALK_DURATION_SECONDS_MAX)
            )
            for agent in store.get_agents()
        }

    def tick(self) -> list[Agent]:
        grid = self._store.get_grid()
        buildings = self._store.get_buildings()
        return [
            self._advance(agent, grid, buildings) for agent in self._store.get_agents()
        ]

    def _advance(self, agent: Agent, grid: Grid, buildings) -> Agent:
        agent_id = agent.id
        self._ticks_remaining[agent_id] -= 1

        if self._ticks_remaining[agent_id] <= 0:
            if self._walking[agent_id]:
                self._walking[agent_id] = False
                self._ticks_remaining[agent_id] = random.randint(
                    _ticks(REST_DURATION_SECONDS_MIN), _ticks(REST_DURATION_SECONDS_MAX)
                )
            else:
                self._walking[agent_id] = True
                self._ticks_remaining[agent_id] = random.randint(
                    _ticks(WALK_DURATION_SECONDS_MIN), _ticks(WALK_DURATION_SECONDS_MAX)
                )
            return self._store.get_agent(agent_id)

        if not self._walking[agent_id]:
            return self._store.get_agent(agent_id)

        for _ in range(len(DIRECTIONS)):
            dx, dy = DIRECTIONS[self._direction_index[agent_id]]
            new_x, new_y = agent.x + dx, agent.y + dy
            blocked = self._hitboxes_enabled and is_blocked(new_x, new_y, buildings)
            if grid.in_bounds(new_x, new_y) and not blocked:
                self._store.set_agent_position(agent_id, new_x, new_y)
                return self._store.get_agent(agent_id)
            self._direction_index[agent_id] = (
                self._direction_index[agent_id] + 1
            ) % len(DIRECTIONS)

        # All directions blocked — stay put.
        return self._store.get_agent(agent_id)
