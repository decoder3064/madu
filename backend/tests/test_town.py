import json

from app.world.town import load_town


def _write_town(tmp_path, entities, width=10, height=10):
    path = tmp_path / "town.json"
    path.write_text(
        json.dumps({"grid": {"width": width, "height": height}, "entities": entities})
    )
    return path


def test_flips_rows_so_map_bottom_becomes_screen_bottom(tmp_path):
    path = _write_town(
        tmp_path,
        [
            {
                "id": "sea", "name": "Sea", "kind": "water", "blocks": True,
                "x_min": 0, "x_max": 9, "y_min": 0, "y_max": 1,
            }
        ],
    )
    sea = load_town(path).entities[0]
    assert (sea.x, sea.y, sea.width, sea.height) == (0, 8, 10, 2)


def test_edges_are_inclusive(tmp_path):
    path = _write_town(
        tmp_path,
        [
            {
                "id": "hut", "name": "Hut", "kind": "building", "blocks": True,
                "x_min": 2, "x_max": 4, "y_min": 5, "y_max": 7,
            }
        ],
    )
    hut = load_town(path).entities[0]
    assert (hut.x, hut.y, hut.width, hut.height) == (2, 2, 3, 3)


def test_real_town_file_loads_every_entity():
    town = load_town()
    assert (town.width, town.height) == (100, 100)
    assert len(town.entities) == 16


def test_real_town_marks_what_blocks_walking():
    town = load_town()
    by_id = {entity.id: entity for entity in town.entities}
    assert by_id["well"].blocks is True
    assert by_id["dock"].blocks is False
    assert by_id["plaza"].blocks is False


def test_to_dict_sends_everything_the_frontend_needs():
    town = load_town()
    kai = next(entity for entity in town.entities if entity.id == "kai-house")
    assert kai.to_dict() == {
        "id": "kai-house",
        "name": "Kai, a fisherman",
        "kind": "building",
        "blocks": True,
        "x": 37,
        "y": 17,
        "width": 6,
        "height": 6,
    }
