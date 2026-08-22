from app.persistence.store import Store
from app.world.agent import Agent
from app.world.grid import Grid

# up, right, down, left
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]


class Simulation:
    def __init__(self, store: Store):
        self._store = store
        self._direction_index = {agent.id: 0 for agent in store.get_agents()}

    def tick(self) -> list[Agent]:
        grid = self._store.get_grid()
        return [self._advance(agent, grid) for agent in self._store.get_agents()]

    def _advance(self, agent: Agent, grid: Grid) -> Agent:
        agent_id = agent.id
        for _ in range(len(DIRECTIONS)):
            dx, dy = DIRECTIONS[self._direction_index[agent_id]]
            new_x, new_y = agent.x + dx, agent.y + dy
            if grid.in_bounds(new_x, new_y):
                self._store.set_agent_position(agent_id, new_x, new_y)
                return self._store.get_agent(agent_id)
            self._direction_index[agent_id] = (
                self._direction_index[agent_id] + 1
            ) % len(DIRECTIONS)

        # All four directions blocked (grid smaller than 2x2) — stay put.
        return self._store.get_agent(agent_id)
