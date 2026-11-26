from collections import deque

from app.world.grid import Grid
from app.world.town import load_town
from app.world.walkability import GRASS_COST, WalkableMap
from tests.helpers import blocker, map_from_text


def test_open_ground_is_walkable():
    walkable = WalkableMap(Grid(10, 10), [])
    assert walkable.is_walkable(5, 5) is True


def test_every_tile_under_a_blocker_is_closed_and_its_edge_neighbors_are_open():
    walkable = WalkableMap(Grid(10, 10), [blocker("hut", x=2, y=2, size=3)])
    assert walkable.is_walkable(2, 2) is False
    assert walkable.is_walkable(4, 4) is False
    assert walkable.is_walkable(5, 4) is True
    assert walkable.is_walkable(1, 2) is True


def test_outside_the_map_is_never_walkable():
    walkable = WalkableMap(Grid(10, 10), [])
    assert walkable.is_walkable(-1, 0) is False
    assert walkable.is_walkable(10, 0) is False


def test_neighbors_skip_walls_and_map_edges():
    walkable = WalkableMap(Grid(10, 10), [blocker("rock", x=1, y=0, size=1)])
    assert walkable.neighbors(0, 0) == [(0, 1)]


def _real_town_map():
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    return town, WalkableMap(Grid(town.width, town.height), blockers)


def test_real_town_closes_the_well_and_opens_the_dock_over_the_sea():
    _, walkable = _real_town_map()
    assert walkable.is_walkable(55, 47) is False
    assert walkable.is_walkable(50, 95) is True
    assert walkable.is_walkable(30, 95) is False


def test_every_walkable_place_can_be_reached_from_the_plaza():
    town, walkable = _real_town_map()
    start = (58, 55)
    reached = {start}
    frontier = deque([start])
    while frontier:
        x, y = frontier.popleft()
        for step in walkable.neighbors(x, y):
            if step not in reached:
                reached.add(step)
                frontier.append(step)

    for entity in town.entities:
        if not entity.blocks:
            assert (entity.x, entity.y) in reached, entity.name


def test_open_ground_costs_grass_by_default():
    walkable = map_from_text(["..."]).walkable
    assert walkable.step_cost(1, 0) == GRASS_COST
    assert walkable.cheapest_cost == GRASS_COST


def test_surfaces_set_their_price_and_the_cheapest_is_remembered():
    walkable = map_from_text(["r.s"]).walkable
    assert walkable.step_cost(0, 0) == 1.0
    assert walkable.step_cost(1, 0) == GRASS_COST
    assert walkable.step_cost(2, 0) == 1.5
    assert walkable.cheapest_cost == 1.0


def test_real_town_prices_each_surface():
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    surfaces = [entity for entity in town.entities if not entity.blocks]
    walkable = WalkableMap(Grid(town.width, town.height), blockers, surfaces)
    assert walkable.step_cost(60, 50) == 1.0
    assert walkable.step_cost(40, 80) == 1.5
    assert walkable.step_cost(35, 60) == GRASS_COST
    assert walkable.step_cost(50, 90) == 1.0
