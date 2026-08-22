from app.world.grid import Grid
from app.world.agent import Agent
from app.persistence.store import Store


def test_get_grid_returns_the_grid():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    store = Store(grid, [agent])
    assert store.get_grid() is grid


def test_get_agents_returns_all_agents_in_order():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    store = Store(grid, [agent1, agent2])
    assert store.get_agents() == [agent1, agent2]


def test_get_agent_by_id():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    store = Store(grid, [agent])
    assert store.get_agent("a1") is agent


def test_set_agent_position_updates_only_the_targeted_agent():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    store = Store(grid, [agent1, agent2])

    store.set_agent_position("a1", 9, 9)

    assert store.get_agent("a1").x == 9
    assert store.get_agent("a1").y == 9
    assert store.get_agent("a2").x == 5
    assert store.get_agent("a2").y == 5
