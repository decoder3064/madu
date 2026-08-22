from app.world.agent import Agent


def test_agent_stores_id_and_position():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.id == "villager-1"
    assert agent.x == 3
    assert agent.y == 7


def test_agent_to_dict():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.to_dict() == {"id": "villager-1", "x": 3, "y": 7}
