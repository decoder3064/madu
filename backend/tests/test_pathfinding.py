from app.world.pathfinding import find_path
from app.world.walkability import GRASS_COST
from tests.helpers import map_from_text
from tests.test_helpers import TOWN_BLOCK


def _assert_valid_route(text_map, route):
    assert route is not None
    assert route.tiles[0] == text_map.start
    assert route.tiles[-1] == text_map.goal
    for tile in route.tiles:
        assert text_map.walkable.is_walkable(*tile), tile
    for (x1, y1), (x2, y2) in zip(route.tiles, route.tiles[1:]):
        assert abs(x1 - x2) + abs(y1 - y2) == 1, ((x1, y1), (x2, y2))


def test_straight_line_across_open_grass():
    text_map = map_from_text(["S....G"])
    route = find_path(text_map.walkable, text_map.start, text_map.goal)
    _assert_valid_route(text_map, route)
    assert len(route.tiles) == 6
    assert route.cost == 5 * GRASS_COST


def test_goes_around_a_wall():
    text_map = map_from_text(
        [
            "S.#.G",
            "..#..",
            ".....",
        ]
    )
    route = find_path(text_map.walkable, text_map.start, text_map.goal)
    _assert_valid_route(text_map, route)
    assert (2, 2) in route.tiles


def test_finds_a_way_through_the_bigger_town_block():
    text_map = map_from_text(TOWN_BLOCK)
    route = find_path(text_map.walkable, text_map.start, text_map.goal)
    _assert_valid_route(text_map, route)


def test_goal_sealed_inside_a_shed_has_no_path():
    text_map = map_from_text(TOWN_BLOCK)
    assert find_path(text_map.walkable, text_map.start, (6, 9)) is None


def test_goal_on_a_wall_has_no_path():
    text_map = map_from_text(["S#"])
    assert find_path(text_map.walkable, text_map.start, (1, 0)) is None


def test_start_equal_to_goal_is_a_one_tile_route():
    text_map = map_from_text(["S.."])
    route = find_path(text_map.walkable, text_map.start, text_map.start)
    assert route.tiles == [text_map.start]
    assert route.cost == 0
