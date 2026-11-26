from app.world.entity import Entity


class Agent(Entity):
    def __init__(
        self,
        agent_id: str,
        x: int,
        y: int,
        name: str = "",
        role: str = "",
        line: str = "",
        backstory: str = "",
    ):
        super().__init__(entity_id=agent_id, x=x, y=y)
        self.name = name
        self.role = role
        self.line = line
        self.backstory = backstory
        self.memories: list[str] = []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "name": self.name,
            "role": self.role,
            "line": self.line,
        }
