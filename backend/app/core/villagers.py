from dataclasses import dataclass


@dataclass
class VillagerDef:
    id: str
    x: int
    y: int
    name: str
    role: str
    line: str
    backstory: str


VILLAGERS: list[VillagerDef] = [
    VillagerDef(
        id="villager-1",
        x=10,
        y=10,
        name="Mira",
        role="Fisherwoman",
        line="The tide's been good to us this week.",
        backstory=(
            "Mira grew up on the water. Her father was lost at sea when she was twelve, "
            "and she took over his boat the same year. She's guarded about her past but "
            "fiercely loyal to anyone who earns her trust. She knows every current and "
            "rock in this harbor better than she knows most people."
        ),
    ),
    VillagerDef(
        id="villager-2",
        x=25,
        y=10,
        name="Tomas",
        role="Baker",
        line="Fresh bread every morning — come by before it's gone.",
        backstory=(
            "Tomas moved to this town five years ago after his bakery in the city burned down. "
            "He doesn't talk about what caused the fire. He throws himself into his work — "
            "up before dawn every day — and has slowly become the social hub of the town "
            "through sheer stubbornness and good bread."
        ),
    ),
    VillagerDef(
        id="villager-3",
        x=17,
        y=25,
        name="Elena",
        role="Merchant",
        line="Business is slow, but the view of the harbor makes up for it.",
        backstory=(
            "Elena inherited her stall from her aunt and never quite planned to stay. "
            "She keeps a ledger of every transaction she's ever made and has a memory "
            "for debts — both owed and paid — that makes some people nervous around her. "
            "She's been saving to buy a boat, though she hasn't told anyone why."
        ),
    ),
]
