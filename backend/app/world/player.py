from app.world.entity import Entity


class Player(Entity):
    def __init__(self, player_id: str, x: int, y: int):
        super().__init__(entity_id=player_id, x=x, y=y)

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
