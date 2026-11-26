import json
from dataclasses import dataclass
from pathlib import Path

from app.world.entity import Entity

DEFAULT_TOWN_PATH = Path(__file__).parent.parent / "data" / "town.json"


class TownEntity(Entity):
    def __init__(
        self,
        entity_id: str,
        name: str,
        kind: str,
        blocks: bool,
        x: int,
        y: int,
        width: int,
        height: int,
        walk_cost: float | None = None,
    ):
        super().__init__(entity_id=entity_id, x=x, y=y, width=width, height=height)
        self.name = name
        self.kind = kind
        self.blocks = blocks
        self.walk_cost = walk_cost

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "blocks": self.blocks,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class Town:
    width: int
    height: int
    entities: list[TownEntity]


def load_town(path: Path = DEFAULT_TOWN_PATH) -> Town:
    data = json.loads(Path(path).read_text())
    grid_height = data["grid"]["height"]

    entities = []
    for raw in data["entities"]:
        width = raw["x_max"] - raw["x_min"] + 1
        height = raw["y_max"] - raw["y_min"] + 1
        # The map counts rows up from the sea; the game counts rows down from the top.
        top_row = grid_height - 1 - raw["y_max"]
        entities.append(
            TownEntity(
                entity_id=raw["id"],
                name=raw["name"],
                kind=raw["kind"],
                blocks=raw["blocks"],
                x=raw["x_min"],
                y=top_row,
                width=width,
                height=height,
                walk_cost=raw.get("walk_cost"),
            )
        )

    return Town(width=data["grid"]["width"], height=grid_height, entities=entities)
