from app.api.messages import parse_go_to_command, parse_move_command


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


def test_parse_move_command_returns_none_for_non_string_direction_list():
    assert parse_move_command('{"type": "move", "direction": ["up"]}') is None


def test_parse_move_command_returns_none_for_non_string_direction_object():
    assert parse_move_command('{"type": "move", "direction": {}}') is None


def test_parse_go_to_reads_villager_and_place():
    raw = '{"type": "go_to", "villager_id": "villager-2", "place_id": "ben-house"}'
    assert parse_go_to_command(raw) == ("villager-2", "ben-house")


def test_parse_go_to_ignores_other_message_types():
    assert parse_go_to_command('{"type": "move", "direction": "up"}') is None


def test_parse_go_to_ignores_missing_or_non_text_fields():
    assert parse_go_to_command('{"type": "go_to", "villager_id": "villager-2"}') is None
    assert parse_go_to_command('{"type": "go_to", "villager_id": 2, "place_id": "well"}') is None


def test_parse_go_to_ignores_invalid_json():
    assert parse_go_to_command("not json") is None


def test_move_parser_ignores_go_to_messages():
    raw = '{"type": "go_to", "villager_id": "villager-2", "place_id": "ben-house"}'
    assert parse_move_command(raw) is None
