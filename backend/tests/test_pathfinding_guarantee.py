import random

import pytest

from app.world.grid import Grid
from app.world.pathfinding import find_path
from app.world.town import load_town
from app.world.walkability import WalkableMap
from tests.helpers import map_from_text
from tests.reference_paths import cheapest_cost
from tests.test_helpers import TOWN_BLOCK


def _walkable_tiles(walkable):
    tiles = []
    for y in range(walkable.height):
        for x in range(walkable.width):
            if walkable.is_walkable(x, y):
                tiles.append((x, y))
    return tiles


def _random_trips(walkable, count, seed):
    rng = random.Random(seed)
    tiles = _walkable_tiles(walkable)
    trips = []
    for _ in range(count):
        trips.append((rng.choice(tiles), rng.choice(tiles)))
    return trips


def _assert_walk_is_valid(walkable, route, start, goal):
    assert route.tiles[0] == start
    assert route.tiles[-1] == goal
    for tile in route.tiles:
        assert walkable.is_walkable(*tile), tile
    for (x1, y1), (x2, y2) in zip(route.tiles, route.tiles[1:]):
        assert abs(x1 - x2) + abs(y1 - y2) == 1


def _check_guarantee(walkable, trips):
    for start, goal in trips:
        best = cheapest_cost(walkable, start, goal)
        exact = find_path(walkable, start, goal, weight=1.0)
        fast = find_path(walkable, start, goal, weight=1.5)

        if best is None:
            assert exact is None and fast is None, (start, goal)
            continue

        _assert_walk_is_valid(walkable, exact, start, goal)
        _assert_walk_is_valid(walkable, fast, start, goal)
        assert exact.cost == pytest.approx(best), (start, goal)
        assert fast.cost <= 1.5 * best + 1e-9, (start, goal)


def test_guarantee_holds_on_the_town_block():
    walkable = map_from_text(TOWN_BLOCK).walkable
    _check_guarantee(walkable, _random_trips(walkable, count=300, seed=1))


def test_guarantee_holds_on_the_real_town():
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    surfaces = [entity for entity in town.entities if not entity.blocks]
    walkable = WalkableMap(Grid(town.width, town.height), blockers, surfaces)
    _check_guarantee(walkable, _random_trips(walkable, count=60, seed=2))
