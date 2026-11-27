from app.persistence.store import Store
from app.world.agent import Agent
from app.world.grid import Grid
from app.world.player import Player
from app.world.simulation import Simulation
from app.world.walkability import WalkableMap
from tests.helpers import blocker


def _sim(walls=(), x=0, y=0):
    agent = Agent(agent_id="a1", x=x, y=y)
    store = Store(Grid(10, 10), [agent], Player(player_id="p1", x=9, y=9), list(walls))
    return store, Simulation(store, hitboxes_enabled=True)


def _position(store):
    agent = store.get_agent("a1")
    return (agent.x, agent.y)


def test_villager_walks_its_route_one_tile_per_tick():
    store, sim = _sim()
    route = sim.send_to("a1", (3, 0))
    for expected in route.tiles[1:]:
        sim.tick()
        assert _position(store) == expected
    assert sim.route_of("a1") == []


def test_villager_walks_around_a_wall_to_reach_the_goal():
    wall = blocker("wall", x=2, y=0, size=2)
    store, sim = _sim(walls=[wall])
    route = sim.send_to("a1", (4, 0))
    for _ in range(len(route.tiles) - 1):
        sim.tick()
    assert _position(store) == (4, 0)


def test_villager_rests_at_the_destination(monkeypatch):
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: 1000)
    store, sim = _sim(x=5, y=5)
    sim.send_to("a1", (6, 5))
    sim.tick()
    sim.tick()
    sim.tick()
    assert _position(store) == (6, 5)


def test_unreachable_goal_is_refused_and_the_villager_keeps_wandering():
    walls = [
        blocker("n", x=5, y=4, size=1),
        blocker("s", x=5, y=6, size=1),
        blocker("w", x=4, y=5, size=1),
        blocker("e", x=6, y=5, size=1),
    ]
    store, sim = _sim(walls=walls)
    assert sim.send_to("a1", (5, 5)) is None
    assert sim.route_of("a1") == []
    sim.tick()
    assert _position(store) == (1, 0)


def test_sending_a_villager_where_they_already_stand_leaves_no_route():
    store, sim = _sim(x=3, y=3)
    assert sim.send_to("a1", (3, 3)) is not None
    assert sim.route_of("a1") == []


def test_villager_plans_again_when_the_map_changes_under_its_route():
    store, sim = _sim()
    sim.send_to("a1", (5, 0))
    # Simulates a building being moved onto the route after it was planned.
    sim._walkable = WalkableMap(Grid(10, 10), [blocker("moved", x=2, y=0, size=1)])
    for _ in range(20):
        sim.tick()
        assert _position(store) != (2, 0)
        if not sim.route_of("a1"):
            break
    assert _position(store) == (5, 0)


def test_send_to_place_stops_beside_a_solid_place():
    house = blocker("house", x=5, y=0, size=2)
    store, sim = _sim(walls=[house])
    route = sim.send_to_place("a1", house)
    assert route.tiles[-1] == (4, 0)


def test_send_to_place_refuses_a_walled_in_place():
    house = blocker("house", x=5, y=5, size=1)
    walls = [
        house,
        blocker("n", x=5, y=4, size=1),
        blocker("s", x=5, y=6, size=1),
        blocker("w", x=4, y=5, size=1),
        blocker("e", x=6, y=5, size=1),
    ]
    store, sim = _sim(walls=walls)
    assert sim.send_to_place("a1", house) is None
