from app.world.town import TownEntity


def is_blocked(x: int, y: int, buildings: list[TownEntity]) -> bool:
    for building in buildings:
        if (
            building.x <= x < building.x + building.width
            and building.y <= y < building.y + building.height
        ):
            return True
    return False
