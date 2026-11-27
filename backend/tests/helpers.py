from dataclasses import dataclass

from app.world.grid import Grid
from app.world.town import TownEntity
from app.world.walkability import WalkableMap


def blocker(entity_id: str, x: int, y: int, size: int) -> TownEntity:
    return TownEntity(
        entity_id=entity_id,
        name=entity_id,
        kind="building",
        blocks=True,
        x=x,
        y=y,
        width=size,
        height=size,
    )


SURFACE_COSTS = {"r": 1.0, "s": 1.5}


@dataclass
class TextMap:
    walkable: WalkableMap
    start: tuple[int, int] | None
    goal: tuple[int, int] | None


def map_from_text(rows: list[str]) -> TextMap:
    width = len(rows[0])
    walls = []
    surfaces = []
    start = None
    goal = None
    for y, row in enumerate(rows):
        if len(row) != width:
            raise ValueError(f"row {y} is {len(row)} wide, expected {width}")
        for x, char in enumerate(row):
            if char == "#":
                walls.append(blocker(f"wall-{x}-{y}", x=x, y=y, size=1))
            elif char in SURFACE_COSTS:
                surfaces.append(
                    TownEntity(
                        entity_id=f"surface-{x}-{y}",
                        name=char,
                        kind="zone",
                        blocks=False,
                        x=x,
                        y=y,
                        width=1,
                        height=1,
                        walk_cost=SURFACE_COSTS[char],
                    )
                )
            elif char == "S":
                start = (x, y)
            elif char == "G":
                goal = (x, y)
            elif char != ".":
                raise ValueError(f"unknown map character {char!r} at ({x}, {y})")
    return TextMap(WalkableMap(Grid(width, len(rows)), walls, surfaces), start, goal)
