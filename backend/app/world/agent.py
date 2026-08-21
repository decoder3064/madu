class Agent:
    def __init__(self, agent_id: str, x: int, y: int):
        self.id = agent_id
        self.x = x
        self.y = y

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
