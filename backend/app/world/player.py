class Player:
    def __init__(self, player_id: str, x: int, y: int):
        self.id = player_id
        self.x = x
        self.y = y

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
