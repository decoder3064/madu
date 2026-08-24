from app.api.messages import parse_move_command


def test_parse_move_command_valid_direction():
    assert parse_move_command('{"type": "move", "direction": "up"}') == "up"


def test_parse_move_command_returns_none_for_invalid_direction():
    assert parse_move_command('{"type": "move", "direction": "sideways"}') is None


def test_parse_move_command_returns_none_for_wrong_type():
    assert parse_move_command('{"type": "chat", "direction": "up"}') is None


def test_parse_move_command_returns_none_for_missing_direction():
    assert parse_move_command('{"type": "move"}') is None


def test_parse_move_command_returns_none_for_invalid_json():
    assert parse_move_command('not json') is None


def test_parse_move_command_returns_none_for_non_object_json():
    assert parse_move_command('[1, 2, 3]') is None
