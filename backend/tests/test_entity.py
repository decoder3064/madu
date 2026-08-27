import pytest

from app.world.entity import Entity


def test_entity_cannot_be_instantiated_directly():
    with pytest.raises(TypeError):
        Entity(entity_id="e1", x=0, y=0)


def test_entity_subclass_must_implement_to_dict():
    class Incomplete(Entity):
        pass

    with pytest.raises(TypeError):
        Incomplete(entity_id="e1", x=0, y=0)


def test_entity_subclass_with_to_dict_can_be_instantiated():
    class Concrete(Entity):
        def to_dict(self) -> dict:
            return {"id": self.id, "x": self.x, "y": self.y}

    entity = Concrete(entity_id="e1", x=3, y=4)
    assert entity.id == "e1"
    assert entity.x == 3
    assert entity.y == 4
    assert entity.width == 1
    assert entity.height == 1


def test_entity_footprint_can_be_overridden():
    class Concrete(Entity):
        def to_dict(self) -> dict:
            return {}

    entity = Concrete(entity_id="e1", x=0, y=0, width=5, height=5)
    assert entity.width == 5
    assert entity.height == 5
