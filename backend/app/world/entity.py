from abc import ABC, abstractmethod


class Entity(ABC):
    def __init__(
        self, entity_id: str, x: int, y: int, width: int = 1, height: int = 1
    ):
        self.id = entity_id
        self.x = x
        self.y = y
        self.width = width
        self.height = height

    @abstractmethod
    def to_dict(self) -> dict:
        raise NotImplementedError
