from app.world.agent import Agent
from app.world.entity import Entity


def test_agent_stores_id_position_and_identity():
    agent = Agent(
        agent_id="villager-1",
        x=3,
        y=7,
        name="Mira",
        role="Fisherwoman",
        line="The tide's been good to us this week.",
    )
    assert agent.id == "villager-1"
    assert agent.x == 3
    assert agent.y == 7
    assert agent.name == "Mira"
    assert agent.role == "Fisherwoman"
    assert agent.line == "The tide's been good to us this week."


def test_agent_to_dict():
    agent = Agent(
        agent_id="villager-1",
        x=3,
        y=7,
        name="Mira",
        role="Fisherwoman",
        line="The tide's been good to us this week.",
    )
    assert agent.to_dict() == {
        "id": "villager-1",
        "x": 3,
        "y": 7,
        "name": "Mira",
        "role": "Fisherwoman",
        "line": "The tide's been good to us this week.",
    }


def test_agent_identity_defaults_to_empty_strings():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.name == ""
    assert agent.role == ""
    assert agent.line == ""


def test_agent_is_an_entity():
    agent = Agent(
        agent_id="villager-1", x=3, y=7, name="Mira", role="Fisherwoman", line="Hi."
    )
    assert isinstance(agent, Entity)


def test_agent_default_footprint_is_one_tile():
    agent = Agent(
        agent_id="villager-1", x=3, y=7, name="Mira", role="Fisherwoman", line="Hi."
    )
    assert agent.width == 1
    assert agent.height == 1
