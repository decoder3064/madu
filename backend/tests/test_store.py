from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building
from app.persistence.store import Store


def test_get_grid_returns_the_grid():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    assert store.get_grid() is grid


def test_get_agents_returns_all_agents_in_order():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player, [])
    assert store.get_agents() == [agent1, agent2]


def test_get_agent_by_id():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    assert store.get_agent("a1") is agent


def test_set_agent_position_updates_only_the_targeted_agent():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player, [])

    store.set_agent_position("a1", 9, 9)

    assert store.get_agent("a1").x == 9
    assert store.get_agent("a1").y == 9
    assert store.get_agent("a2").x == 5
    assert store.get_agent("a2").y == 5


def test_get_player_returns_the_player():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=2, y=2)
    store = Store(grid, [agent], player, [])
    assert store.get_player() is player


def test_set_player_position_updates_the_player_only():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=2, y=2)
    store = Store(grid, [agent], player, [])

    store.set_player_position(9, 9)

    assert store.get_player().x == 9
    assert store.get_player().y == 9
    assert store.get_agent("a1").x == 0
    assert store.get_agent("a1").y == 0


def test_get_buildings_returns_all_buildings():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    building1 = Building(building_id="b1", x=10, y=10, size=5)
    building2 = Building(building_id="b2", x=20, y=20, size=5)
    store = Store(grid, [agent], player, [building1, building2])
    assert store.get_buildings() == [building1, building2]
