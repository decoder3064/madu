from app.world.town import TownEntity


def blocker(entity_id: str, x: int, y: int, size: int) -> TownEntity:
    return TownEntity(
        entity_id=entity_id,
        name=entity_id,
        kind="building",
        blocks=True,
        x=x,
        y=y,
        width=size,
        height=size,
    )
