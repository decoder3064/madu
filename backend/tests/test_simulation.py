from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.persistence.store import Store
from app.world.simulation import Simulation


def test_tick_moves_single_agent_up_first():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store)

    result = sim.tick()

    assert len(result) == 1
    assert (result[0].x, result[0].y) == (10, 9)


def test_tick_cycles_direction_at_top_edge():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 0)


def test_tick_advances_every_agent_independently():
    # Proves the multi-agent seam works even though phase 1a ships one agent.
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=10, y=10)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player, [])
    sim = Simulation(store)

    result = sim.tick()

    positions = {agent.id: (agent.x, agent.y) for agent in result}
    assert positions["a1"] == (10, 9)
    assert positions["a2"] == (5, 4)


def test_tick_returns_agents_from_the_store():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store)

    result = sim.tick()

    assert result[0] is store.get_agent("a1")
