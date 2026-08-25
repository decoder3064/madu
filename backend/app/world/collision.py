from app.world.building import Building


def is_blocked(x: int, y: int, buildings: list[Building]) -> bool:
    for building in buildings:
        if (
            building.x <= x < building.x + building.width
            and building.y <= y < building.y + building.height
        ):
            return True
    return False
