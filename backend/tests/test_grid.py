from app.world.grid import Grid


def test_in_bounds_true_for_position_inside_grid():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(5, 5) is True


def test_in_bounds_true_for_origin():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(0, 0) is True


def test_in_bounds_false_for_negative_position():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(-1, 5) is False


def test_in_bounds_false_at_width_edge():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(20, 5) is False


def test_in_bounds_true_at_last_valid_column():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(19, 5) is True
