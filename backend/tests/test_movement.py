import pytest

from app.world.grid import Grid
from app.world.movement import apply_move


def test_apply_move_up_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "up") == (10, 9)


def test_apply_move_right_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "right") == (11, 10)


def test_apply_move_down_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "down") == (10, 11)


def test_apply_move_left_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "left") == (9, 10)


def test_apply_move_blocked_at_top_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 0, "up") == (10, 0)


def test_apply_move_blocked_at_left_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 0, 10, "left") == (0, 10)


def test_apply_move_blocked_at_bottom_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 19, "down") == (10, 19)


def test_apply_move_blocked_at_right_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 19, 10, "right") == (19, 10)


def test_apply_move_raises_for_invalid_direction():
    grid = Grid(width=20, height=20)
    with pytest.raises(KeyError):
        apply_move(grid, 10, 10, "diagonal")
