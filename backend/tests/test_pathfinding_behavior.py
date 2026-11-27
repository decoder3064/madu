import time

from app.world.grid import Grid
from app.world.pathfinding import find_path
from app.world.town import load_town
from app.world.walkability import WalkableMap
from tests.helpers import map_from_text

ROAD_DETOUR = [
    "S.........G",
    "...........",
    "rrrrrrrrrrr",
]

# West end of the lighthouse path to the far east edge of town.
FAR_APART = ((10, 66), (99, 20))


def _turns(tiles):
    count = 0
    for a, b, c in zip(tiles, tiles[1:], tiles[2:]):
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
            count += 1
    return count


def _real_town():
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    surfaces = [entity for entity in town.entities if not entity.blocks]
    return WalkableMap(Grid(town.width, town.height), blockers, surfaces)


def test_takes_the_road_when_it_is_cheaper_than_cutting_across_grass():
    text_map = map_from_text(ROAD_DETOUR)
    route = find_path(text_map.walkable, text_map.start, text_map.goal)
    for x in range(1, 10):
        assert (x, 2) in route.tiles


def test_crosses_an_open_field_with_at_most_one_turn():
    field = ["S" + "." * 19] + ["." * 20] * 18 + ["." * 19 + "G"]
    text_map = map_from_text(field)
    route = find_path(text_map.walkable, text_map.start, text_map.goal)
    assert _turns(route.tiles) <= 1


def test_cross_town_trip_goes_through_the_plaza():
    route = find_path(_real_town(), (35, 40), (80, 40))
    on_plaza = [tile for tile in route.tiles if 45 <= tile[0] <= 70 and 34 <= tile[1] <= 54]
    assert len(on_plaza) > len(route.tiles) // 2


def test_worst_case_trip_is_fast():
    walkable = _real_town()
    started = time.perf_counter()
    route = find_path(walkable, *FAR_APART)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert route is not None
    # Measured about 39 ms; the budget is loose so a slower machine doesn't flake.
    assert elapsed_ms < 100


def test_higher_weight_explores_fewer_tiles():
    walkable = _real_town()
    explored = []
    for weight in (1.0, 1.5, 2.0):
        explored.append(find_path(walkable, *FAR_APART, weight=weight).explored)
    assert explored[0] > explored[1] > explored[2]
