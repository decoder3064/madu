from app.world.player import Player
from app.world.entity import Entity


def test_player_stores_id_and_position():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.id == "player-1"
    assert player.x == 3
    assert player.y == 7


def test_player_to_dict():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.to_dict() == {"id": "player-1", "x": 3, "y": 7}


def test_player_is_an_entity():
    player = Player(player_id="player-1", x=3, y=7)
    assert isinstance(player, Entity)


def test_player_default_footprint_is_one_tile():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.width == 1
    assert player.height == 1
