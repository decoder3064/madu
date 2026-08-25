from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building
from app.persistence.store import Store
from app.world.simulation import Simulation


def test_tick_moves_single_agent_up_first():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert len(result) == 1
    assert (result[0].x, result[0].y) == (10, 9)


def test_tick_cycles_direction_at_top_edge():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 0)


def test_tick_advances_every_agent_independently():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=10, y=10)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    positions = {agent.id: (agent.x, agent.y) for agent in result}
    assert positions["a1"] == (10, 9)
    assert positions["a2"] == (5, 4)


def test_tick_returns_agents_from_the_store():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert result[0] is store.get_agent("a1")


def test_agent_turns_away_from_building_when_hitboxes_enabled(monkeypatch):
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: 1000)
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    building = Building(building_id="b1", x=9, y=0, size=10)
    store = Store(grid, [agent], player, [building])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 10)


def test_agent_ignores_building_when_hitboxes_disabled(monkeypatch):
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: 1000)
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    building = Building(building_id="b1", x=9, y=0, size=10)
    store = Store(grid, [agent], player, [building])
    sim = Simulation(store, hitboxes_enabled=False)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (10, 9)


def test_agent_does_not_move_while_resting(monkeypatch):
    durations = iter([1, 100])  # initial walk duration 1 tick, then rest duration 100 ticks
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: next(durations))
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    sim.tick()  # walk duration (1) elapses this tick -> switches to resting, no move
    sim.tick()  # resting, 99 ticks left, no move

    assert (store.get_agent("a1").x, store.get_agent("a1").y) == (10, 10)


def test_agent_resumes_walking_after_rest_elapses(monkeypatch):
    durations = iter([1, 1, 100])  # walk 1 tick, rest 1 tick, then walk 100 ticks
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: next(durations))
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    sim.tick()  # walk(1) elapses -> resting, no move
    sim.tick()  # rest(1) elapses -> walking again, no move (transition tick)
    result = sim.tick()  # now actually walking, moves one step

    assert (result[0].x, result[0].y) == (10, 9)
