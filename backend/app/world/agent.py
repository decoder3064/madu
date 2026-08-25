from app.world.entity import Entity


class Agent(Entity):
    def __init__(self, agent_id: str, x: int, y: int):
        super().__init__(entity_id=agent_id, x=x, y=y)

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
