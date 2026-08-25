from app.world.building import Building
from app.world.collision import is_blocked


def test_is_blocked_true_inside_building_footprint():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(12, 12, [building]) is True


def test_is_blocked_true_at_building_top_left_corner():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(10, 10, [building]) is True


def test_is_blocked_false_just_outside_building_footprint():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(15, 10, [building]) is False


def test_is_blocked_false_with_no_buildings():
    assert is_blocked(10, 10, []) is False


def test_is_blocked_checks_every_building():
    building1 = Building(building_id="b1", x=0, y=0, size=5)
    building2 = Building(building_id="b2", x=20, y=20, size=5)
    assert is_blocked(22, 22, [building1, building2]) is True
