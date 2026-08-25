from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building


class Store:
    def __init__(
        self,
        grid: Grid,
        agents: list[Agent],
        player: Player,
        buildings: list[Building],
    ):
        self._grid = grid
        self._agents = {agent.id: agent for agent in agents}
        self._player = player
        self._buildings = buildings

    def get_grid(self) -> Grid:
        return self._grid

    def get_agents(self) -> list[Agent]:
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> Agent:
        return self._agents[agent_id]

    def set_agent_position(self, agent_id: str, x: int, y: int) -> None:
        self._agents[agent_id].x = x
        self._agents[agent_id].y = y

    def get_player(self) -> Player:
        return self._player

    def set_player_position(self, x: int, y: int) -> None:
        self._player.x = x
        self._player.y = y

    def get_buildings(self) -> list[Building]:
        return self._buildings
