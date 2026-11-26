import pytest

from tests.helpers import map_from_text


def test_reads_walls_start_and_goal():
    text_map = map_from_text(
        [
            "S.#",
            "..G",
        ]
    )
    assert text_map.start == (0, 0)
    assert text_map.goal == (2, 1)
    assert text_map.walkable.is_walkable(2, 0) is False
    assert text_map.walkable.is_walkable(1, 0) is True
    assert (text_map.walkable.width, text_map.walkable.height) == (3, 2)


def test_start_and_goal_tiles_are_walkable():
    text_map = map_from_text(["SG"])
    assert text_map.walkable.is_walkable(0, 0) is True
    assert text_map.walkable.is_walkable(1, 0) is True


def test_rejects_rows_of_different_widths():
    with pytest.raises(ValueError):
        map_from_text(["...", ".."])


def test_rejects_unknown_characters():
    with pytest.raises(ValueError):
        map_from_text(["S.x"])


TOWN_BLOCK = [
    "S.............................",
    "..####....######.....####.....",
    "..#..#....#....#.....#..#.....",
    "..#..#....#....#.....#..#.....",
    "..##.#....###.##.....##.#.....",
    "..............................",
    "########.############.########",
    "..............................",
    "....#####......#####..........",
    "....#...#......#...#..........",
    "....#####......#####.........G",
    "..............................",
]


def test_bigger_map_matches_the_drawing_tile_for_tile():
    text_map = map_from_text(TOWN_BLOCK)
    assert (text_map.walkable.width, text_map.walkable.height) == (30, 12)
    assert text_map.start == (0, 0)
    assert text_map.goal == (29, 10)
    for y, row in enumerate(TOWN_BLOCK):
        for x, char in enumerate(row):
            assert text_map.walkable.is_walkable(x, y) == (char != "#"), (x, y)
