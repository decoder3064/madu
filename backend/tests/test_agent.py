from app.world.agent import Agent
from app.world.entity import Entity


def test_agent_stores_id_and_position():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.id == "villager-1"
    assert agent.x == 3
    assert agent.y == 7


def test_agent_to_dict():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.to_dict() == {"id": "villager-1", "x": 3, "y": 7}


def test_agent_is_an_entity():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert isinstance(agent, Entity)


def test_agent_default_footprint_is_one_tile():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.width == 1
    assert agent.height == 1
