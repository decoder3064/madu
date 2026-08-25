from app.world.entity import Entity


class Building(Entity):
    def __init__(self, building_id: str, x: int, y: int, size: int):
        super().__init__(entity_id=building_id, x=x, y=y, width=size, height=size)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }
