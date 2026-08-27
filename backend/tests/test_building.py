from app.world.building import Building
from app.world.entity import Entity


def test_building_stores_id_position_and_size():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert building.id == "building-1"
    assert building.x == 15
    assert building.y == 15
    assert building.width == 5
    assert building.height == 5


def test_building_to_dict():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert building.to_dict() == {
        "id": "building-1",
        "x": 15,
        "y": 15,
        "width": 5,
        "height": 5,
    }


def test_building_is_an_entity():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert isinstance(building, Entity)
