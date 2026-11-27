from app.core.config import PLAYER_START_X, PLAYER_START_Y
from app.core.villagers import VILLAGERS
from app.world.collision import is_blocked
from app.world.town import load_town


def _blockers():
    return [entity for entity in load_town().entities if entity.blocks]


def test_every_villager_starts_on_open_ground():
    blockers = _blockers()
    for villager in VILLAGERS:
        assert not is_blocked(villager.x, villager.y, blockers), villager.name


def test_player_starts_on_open_ground():
    assert not is_blocked(PLAYER_START_X, PLAYER_START_Y, _blockers())
