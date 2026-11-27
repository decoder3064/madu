from app.world.pathfinding import Tile
from app.world.town import TownEntity
from app.world.walkability import WalkableMap


def destination_tile(
    place: TownEntity, walkable: WalkableMap, from_tile: Tile | None = None
) -> Tile | None:
    center = _center(place)
    if place.blocks:
        candidates = _tiles_around(place)
        anchor = from_tile if from_tile is not None else center
    else:
        candidates = _tiles_inside(place)
        anchor = center

    best = None
    best_key = None
    for tile in candidates:
        if not walkable.is_walkable(*tile):
            continue
        key = (_distance(tile, anchor), _distance(tile, center), tile[1], tile[0])
        if best_key is None or key < best_key:
            best = tile
            best_key = key
    return best


def _center(place: TownEntity) -> tuple[float, float]:
    return (place.x + (place.width - 1) / 2, place.y + (place.height - 1) / 2)


def _distance(tile: Tile, point: tuple[float, float]) -> float:
    return abs(tile[0] - point[0]) + abs(tile[1] - point[1])


def _tiles_inside(place: TownEntity) -> list[Tile]:
    tiles = []
    for y in range(place.y, place.y + place.height):
        for x in range(place.x, place.x + place.width):
            tiles.append((x, y))
    return tiles


def _tiles_around(place: TownEntity) -> list[Tile]:
    tiles = []
    for x in range(place.x, place.x + place.width):
        tiles.append((x, place.y - 1))
        tiles.append((x, place.y + place.height))
    for y in range(place.y, place.y + place.height):
        tiles.append((place.x - 1, y))
        tiles.append((place.x + place.width, y))
    return tiles
