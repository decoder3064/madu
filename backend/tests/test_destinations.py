from app.world.destinations import destination_tile
from app.world.grid import Grid
from app.world.town import TownEntity, load_town
from app.world.walkability import WalkableMap
from tests.helpers import blocker


def _zone(x, y, size):
    return TownEntity(
        entity_id="zone", name="zone", kind="zone", blocks=False,
        x=x, y=y, width=size, height=size,
    )


def _touches_side(tile, place):
    x, y = tile
    beside_horizontally = place.y <= y < place.y + place.height and (
        x == place.x - 1 or x == place.x + place.width
    )
    beside_vertically = place.x <= x < place.x + place.width and (
        y == place.y - 1 or y == place.y + place.height
    )
    return beside_horizontally or beside_vertically


def test_open_place_sends_you_to_its_middle():
    walkable = WalkableMap(Grid(7, 7), [])
    assert destination_tile(_zone(0, 0, 5), walkable) == (2, 2)


def test_open_place_with_a_blocked_middle_picks_the_nearest_open_tile_inside():
    walkable = WalkableMap(Grid(7, 7), [blocker("well", x=2, y=2, size=1)])
    assert destination_tile(_zone(0, 0, 5), walkable) == (2, 1)


def test_solid_place_sends_you_to_the_side_facing_the_villager():
    house = blocker("house", x=3, y=3, size=2)
    walkable = WalkableMap(Grid(8, 8), [house])
    assert destination_tile(house, walkable, from_tile=(0, 3)) == (2, 3)
    assert destination_tile(house, walkable, from_tile=(7, 4)) == (5, 4)


def test_solid_place_never_picks_a_corner():
    house = blocker("house", x=3, y=3, size=2)
    walkable = WalkableMap(Grid(8, 8), [house])
    tile = destination_tile(house, walkable, from_tile=(0, 0))
    assert _touches_side(tile, house)


def test_walled_in_place_has_no_destination():
    house = blocker("house", x=1, y=1, size=1)
    walls = [
        house,
        blocker("n", x=1, y=0, size=1),
        blocker("s", x=1, y=2, size=1),
        blocker("w", x=0, y=1, size=1),
        blocker("e", x=2, y=1, size=1),
    ]
    walkable = WalkableMap(Grid(3, 3), walls)
    assert destination_tile(house, walkable) is None


def _real_town():
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    surfaces = [entity for entity in town.entities if not entity.blocks]
    places = {entity.id: entity for entity in town.entities}
    return places, WalkableMap(Grid(town.width, town.height), blockers, surfaces)


def test_real_town_market_from_tomas_is_an_open_tile_beside_it():
    places, walkable = _real_town()
    tile = destination_tile(places["elena-market"], walkable, from_tile=(60, 50))
    assert walkable.is_walkable(*tile)
    assert _touches_side(tile, places["elena-market"])


def test_real_town_every_place_has_a_destination():
    places, walkable = _real_town()
    for place in places.values():
        assert destination_tile(place, walkable) is not None, place.id
