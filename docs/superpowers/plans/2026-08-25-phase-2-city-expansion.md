# Phase 2: City Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the world from a 20x20 board with one villager into a 50x50
board with three villagers (each alternating walk/rest cycles), two static
buildings that block movement via a togglable hitbox system, and matching
frontend rendering (bigger grid, gray building boxes, a grid-edge border, a
repositioned camera).

**Architecture:** A new abstract `Entity` base class becomes the shared shape
(`id`, `x`, `y`, `width`, `height`) for `Agent`, `Player`, and the new
`Building`. Collision is one generic function checking whether a tile falls
inside any building's footprint, gated by a single config flag
(`HITBOXES_ENABLED`). Villagers gain a walk/rest state machine layered on
top of their existing direction-cycling movement from phase 1a.

**Tech Stack:** Python 3.11+, FastAPI, pytest/pytest-asyncio (backend);
Vite, React 18, TypeScript, Three.js, Vitest (frontend) — unchanged from
phase 1a/1b.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-2-city-expansion-design.md`

## Global Constraints

- Grid grows to `GRID_WIDTH = 50`, `GRID_HEIGHT = 50`.
- Three villagers total: existing `villager-1` at (10,10) unchanged, plus
  `villager-2` at (25,10) and `villager-3` at (10,25).
- Two buildings, each a `BUILDING_SIZE = 5` square: `building-1` at (15,15),
  `building-2` at (35,35).
- `HITBOXES_ENABLED = True` by default — a single global config flag, not
  per-entity or per-request.
- Walk duration: random 60-120 seconds. Rest duration: random 300-360
  seconds. Each villager's countdown is independent.
- `Entity` is an abstract base class (Python's `ABC` + `@abstractmethod`) —
  it can never be instantiated directly, only its subclasses can.
- Buildings are sent to the browser once, in the initial connect payload
  only — never repeated in periodic tick broadcasts, since they never
  change.
- Every task that changes a class's constructor signature or a function's
  parameters must, in the same task, update every existing caller (main.py,
  every test file that constructs it) — never leave a caller broken for a
  later task to fix. This was a real gap in phase 1b's plan; this plan
  avoids repeating it by folding each signature change together with every
  site that consumes it.

---

### Task 1: Phase 2 config constants

**Files:**
- Modify: `backend/app/core/config.py`

**Interfaces:**
- Produces: `GRID_WIDTH`, `GRID_HEIGHT` (now 50), `AGENT_2_START_ID/X/Y`,
  `AGENT_3_START_ID/X/Y`, `BUILDING_SIZE`, `BUILDING_1_ID/X/Y`,
  `BUILDING_2_ID/X/Y`, `HITBOXES_ENABLED`, `WALK_DURATION_SECONDS_MIN/MAX`,
  `REST_DURATION_SECONDS_MIN/MAX` — every later task imports these by name,
  verbatim.

- [ ] **Step 1: Replace the file's contents**

```python
GRID_WIDTH = 50
GRID_HEIGHT = 50
AGENT_START_ID = "villager-1"
AGENT_START_X = 10
AGENT_START_Y = 10
AGENT_2_START_ID = "villager-2"
AGENT_2_START_X = 25
AGENT_2_START_Y = 10
AGENT_3_START_ID = "villager-3"
AGENT_3_START_X = 10
AGENT_3_START_Y = 25
PLAYER_START_ID = "player-1"
PLAYER_START_X = 5
PLAYER_START_Y = 5
TICK_INTERVAL_SECONDS = 0.5
BUILDING_SIZE = 5
BUILDING_1_ID = "building-1"
BUILDING_1_X = 15
BUILDING_1_Y = 15
BUILDING_2_ID = "building-2"
BUILDING_2_X = 35
BUILDING_2_Y = 35
HITBOXES_ENABLED = True
WALK_DURATION_SECONDS_MIN = 60
WALK_DURATION_SECONDS_MAX = 120
REST_DURATION_SECONDS_MIN = 300
REST_DURATION_SECONDS_MAX = 360
```

- [ ] **Step 2: Verify nothing broke**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all existing tests still pass (grid size changing to 50 doesn't
affect any existing assertion — every existing test builds its own `Grid`
instance directly with an explicit width/height, not from config).

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py
git commit -m "config: add phase 2 constants (bigger grid, 2 more villagers, buildings, hitbox flag, walk/rest durations)"
```

---

### Task 2: `Entity` abstract base class

**Files:**
- Create: `backend/app/world/entity.py`
- Test: `backend/tests/test_entity.py`

**Interfaces:**
- Produces: `Entity(ABC)` — constructor `(entity_id: str, x: int, y: int,
  width: int = 1, height: int = 1)`, sets `.id`, `.x`, `.y`, `.width`,
  `.height`; declares abstract `to_dict() -> dict`. Every later entity type
  subclasses this.

- [ ] **Step 1: Write the failing tests**

```python
import pytest

from app.world.entity import Entity


def test_entity_cannot_be_instantiated_directly():
    with pytest.raises(TypeError):
        Entity(entity_id="e1", x=0, y=0)


def test_entity_subclass_must_implement_to_dict():
    class Incomplete(Entity):
        pass

    with pytest.raises(TypeError):
        Incomplete(entity_id="e1", x=0, y=0)


def test_entity_subclass_with_to_dict_can_be_instantiated():
    class Concrete(Entity):
        def to_dict(self) -> dict:
            return {"id": self.id, "x": self.x, "y": self.y}

    entity = Concrete(entity_id="e1", x=3, y=4)
    assert entity.id == "e1"
    assert entity.x == 3
    assert entity.y == 4
    assert entity.width == 1
    assert entity.height == 1


def test_entity_footprint_can_be_overridden():
    class Concrete(Entity):
        def to_dict(self) -> dict:
            return {}

    entity = Concrete(entity_id="e1", x=0, y=0, width=5, height=5)
    assert entity.width == 5
    assert entity.height == 5
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_entity.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.world.entity'`

- [ ] **Step 3: Write the implementation**

```python
from abc import ABC, abstractmethod


class Entity(ABC):
    def __init__(
        self, entity_id: str, x: int, y: int, width: int = 1, height: int = 1
    ):
        self.id = entity_id
        self.x = x
        self.y = y
        self.width = width
        self.height = height

    @abstractmethod
    def to_dict(self) -> dict:
        raise NotImplementedError
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_entity.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/entity.py backend/tests/test_entity.py
git commit -m "feat: add abstract Entity base class"
```

---

### Task 3: `Agent` and `Player` inherit from `Entity`

**Files:**
- Modify: `backend/app/world/agent.py`
- Modify: `backend/app/world/player.py`
- Modify: `backend/tests/test_agent.py`
- Modify: `backend/tests/test_player.py`

**Interfaces:**
- Consumes: `Entity` from Task 2.
- Produces: `Agent` and `Player` keep their exact existing public shape
  (`Agent(agent_id, x, y)`, `Player(player_id, x, y)`, both with `.id`,
  `.x`, `.y`, `.to_dict()` returning `{id, x, y}`) — no caller anywhere else
  in the codebase needs to change.

- [ ] **Step 1: Write the failing tests (append to each file)**

Add to `backend/tests/test_agent.py` (keep the existing two tests as-is):

```python
from app.world.entity import Entity


def test_agent_is_an_entity():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert isinstance(agent, Entity)


def test_agent_default_footprint_is_one_tile():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.width == 1
    assert agent.height == 1
```

Add to `backend/tests/test_player.py` (keep the existing two tests as-is):

```python
from app.world.entity import Entity


def test_player_is_an_entity():
    player = Player(player_id="player-1", x=3, y=7)
    assert isinstance(player, Entity)


def test_player_default_footprint_is_one_tile():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.width == 1
    assert player.height == 1
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_agent.py tests/test_player.py -v`
Expected: FAIL — `Agent`/`Player` aren't `Entity` instances yet.

- [ ] **Step 3: Update the implementations**

`backend/app/world/agent.py`:

```python
from app.world.entity import Entity


class Agent(Entity):
    def __init__(self, agent_id: str, x: int, y: int):
        super().__init__(entity_id=agent_id, x=x, y=y)

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
```

`backend/app/world/player.py`:

```python
from app.world.entity import Entity


class Player(Entity):
    def __init__(self, player_id: str, x: int, y: int):
        super().__init__(entity_id=player_id, x=x, y=y)

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
```

- [ ] **Step 4: Run to verify everything passes**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass, including the two new ones per file.

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/agent.py backend/app/world/player.py backend/tests/test_agent.py backend/tests/test_player.py
git commit -m "refactor: Agent and Player inherit from Entity"
```

---

### Task 4: `Building` class

**Files:**
- Create: `backend/app/world/building.py`
- Test: `backend/tests/test_building.py`

**Interfaces:**
- Consumes: `Entity` from Task 2.
- Produces: `Building(building_id: str, x: int, y: int, size: int)`, a
  square footprint (`width == height == size`), `.to_dict()` returns
  `{id, x, y, width, height}`.

- [ ] **Step 1: Write the failing tests**

```python
from app.world.building import Building
from app.world.entity import Entity


def test_building_stores_id_position_and_size():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert building.id == "building-1"
    assert building.x == 15
    assert building.y == 15
    assert building.width == 5
    assert building.height == 5


def test_building_to_dict():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert building.to_dict() == {
        "id": "building-1",
        "x": 15,
        "y": 15,
        "width": 5,
        "height": 5,
    }


def test_building_is_an_entity():
    building = Building(building_id="building-1", x=15, y=15, size=5)
    assert isinstance(building, Entity)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_building.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
from app.world.entity import Entity


class Building(Entity):
    def __init__(self, building_id: str, x: int, y: int, size: int):
        super().__init__(entity_id=building_id, x=x, y=y, width=size, height=size)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_building.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/building.py backend/tests/test_building.py
git commit -m "feat: add Building entity"
```

---

### Task 5: Collision check (`is_blocked`)

**Files:**
- Create: `backend/app/world/collision.py`
- Test: `backend/tests/test_collision.py`

**Interfaces:**
- Consumes: `Building` from Task 4.
- Produces: `is_blocked(x: int, y: int, buildings: list[Building]) -> bool`
  — later consumed by Task 7 (`apply_move`) and Task 8 (`Simulation`).

- [ ] **Step 1: Write the failing tests**

```python
from app.world.building import Building
from app.world.collision import is_blocked


def test_is_blocked_true_inside_building_footprint():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(12, 12, [building]) is True


def test_is_blocked_true_at_building_top_left_corner():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(10, 10, [building]) is True


def test_is_blocked_false_just_outside_building_footprint():
    building = Building(building_id="b1", x=10, y=10, size=5)
    assert is_blocked(15, 10, [building]) is False


def test_is_blocked_false_with_no_buildings():
    assert is_blocked(10, 10, []) is False


def test_is_blocked_checks_every_building():
    building1 = Building(building_id="b1", x=0, y=0, size=5)
    building2 = Building(building_id="b2", x=20, y=20, size=5)
    assert is_blocked(22, 22, [building1, building2]) is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_collision.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
from app.world.building import Building


def is_blocked(x: int, y: int, buildings: list[Building]) -> bool:
    for building in buildings:
        if (
            building.x <= x < building.x + building.width
            and building.y <= y < building.y + building.height
        ):
            return True
    return False
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_collision.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/collision.py backend/tests/test_collision.py
git commit -m "feat: add is_blocked collision check against building footprints"
```

---

### Task 6: `Store` gains buildings

**Files:**
- Modify: `backend/app/persistence/store.py`
- Modify: `backend/tests/test_store.py`
- Modify: `backend/tests/test_simulation.py` (mechanical only — every
  existing `Store(...)` call needs a 4th argument)
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `Building` from Task 4.
- Produces: `Store.__init__(grid, agents, player, buildings)` (was 3 args,
  now 4 — every existing caller must be updated in this task, not later),
  `Store.get_buildings() -> list[Building]`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_store.py` (add the `Building` import and this
new test; every *existing* test in this file also needs its `Store(...)`
call updated — see Step 3):

```python
from app.world.building import Building


def test_get_buildings_returns_all_buildings():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    building1 = Building(building_id="b1", x=10, y=10, size=5)
    building2 = Building(building_id="b2", x=20, y=20, size=5)
    store = Store(grid, [agent], player, [building1, building2])
    assert store.get_buildings() == [building1, building2]
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_store.py -v`
Expected: FAIL — `TypeError: Store.__init__() takes 4 positional arguments but 5 were given`

- [ ] **Step 3: Update every existing `Store(...)` call**

In `backend/tests/test_store.py`, add `, []` as the 4th argument to every
one of the six existing `Store(grid, [...], player)` calls (they don't care
about buildings, so an empty list is correct for all of them).

In `backend/tests/test_simulation.py`, add `, []` as the 4th argument to
every existing `Store(grid, [agent...], player)` call (four call sites,
mechanical only — `Simulation` itself isn't touched in this task).

- [ ] **Step 4: Write the implementation**

```python
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building


class Store:
    def __init__(
        self,
        grid: Grid,
        agents: list[Agent],
        player: Player,
        buildings: list[Building],
    ):
        self._grid = grid
        self._agents = {agent.id: agent for agent in agents}
        self._player = player
        self._buildings = buildings

    def get_grid(self) -> Grid:
        return self._grid

    def get_agents(self) -> list[Agent]:
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> Agent:
        return self._agents[agent_id]

    def set_agent_position(self, agent_id: str, x: int, y: int) -> None:
        self._agents[agent_id].x = x
        self._agents[agent_id].y = y

    def get_player(self) -> Player:
        return self._player

    def set_player_position(self, x: int, y: int) -> None:
        self._player.x = x
        self._player.y = y

    def get_buildings(self) -> list[Building]:
        return self._buildings
```

- [ ] **Step 5: Update `main.py`'s `Store(...)` call**

In `backend/app/main.py`, add these imports:

```python
from app.core.config import (
    GRID_WIDTH,
    GRID_HEIGHT,
    AGENT_START_ID,
    AGENT_START_X,
    AGENT_START_Y,
    TICK_INTERVAL_SECONDS,
    PLAYER_START_ID,
    PLAYER_START_X,
    PLAYER_START_Y,
    BUILDING_SIZE,
    BUILDING_1_ID,
    BUILDING_1_X,
    BUILDING_1_Y,
    BUILDING_2_ID,
    BUILDING_2_X,
    BUILDING_2_Y,
)
from app.world.building import Building
```

(This adds to the existing import block and adds the new `Building` import
— keep every existing imported name.)

Change the `Store(...)` construction in `create_app()`:

```python
    store = Store(
        Grid(GRID_WIDTH, GRID_HEIGHT),
        [Agent(agent_id=AGENT_START_ID, x=AGENT_START_X, y=AGENT_START_Y)],
        Player(player_id=PLAYER_START_ID, x=PLAYER_START_X, y=PLAYER_START_Y),
        [
            Building(
                building_id=BUILDING_1_ID, x=BUILDING_1_X, y=BUILDING_1_Y, size=BUILDING_SIZE
            ),
            Building(
                building_id=BUILDING_2_ID, x=BUILDING_2_X, y=BUILDING_2_Y, size=BUILDING_SIZE
            ),
        ],
    )
```

(The villager list stays at one agent for now — Task 9 grows it to three.
The grid is already 50x50 from Task 1's config change.)

- [ ] **Step 6: Run the full suite**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/persistence/store.py backend/tests/test_store.py backend/tests/test_simulation.py backend/app/main.py
git commit -m "feat: Store tracks buildings; wire two buildings into main.py startup"
```

---

### Task 7: `apply_move` becomes hitbox-aware

**Files:**
- Modify: `backend/app/world/movement.py`
- Modify: `backend/tests/test_movement.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `Building` (Task 4), `is_blocked` (Task 5), `Store.get_buildings()`
  (Task 6).
- Produces: `apply_move(grid, x, y, direction, buildings, hitboxes_enabled)`
  — two new required parameters. Every existing caller must be updated in
  this task.

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/test_movement.py` entirely with:

```python
import pytest

from app.world.grid import Grid
from app.world.building import Building
from app.world.movement import apply_move


def test_apply_move_up_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "up", buildings=[], hitboxes_enabled=True) == (10, 9)


def test_apply_move_right_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "right", buildings=[], hitboxes_enabled=True) == (11, 10)


def test_apply_move_down_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "down", buildings=[], hitboxes_enabled=True) == (10, 11)


def test_apply_move_left_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "left", buildings=[], hitboxes_enabled=True) == (9, 10)


def test_apply_move_blocked_at_top_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 0, "up", buildings=[], hitboxes_enabled=True) == (10, 0)


def test_apply_move_blocked_at_left_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 0, 10, "left", buildings=[], hitboxes_enabled=True) == (0, 10)


def test_apply_move_blocked_at_bottom_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 19, "down", buildings=[], hitboxes_enabled=True) == (10, 19)


def test_apply_move_blocked_at_right_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 19, 10, "right", buildings=[], hitboxes_enabled=True) == (19, 10)


def test_apply_move_raises_for_invalid_direction():
    grid = Grid(width=20, height=20)
    with pytest.raises(KeyError):
        apply_move(grid, 10, 10, "diagonal", buildings=[], hitboxes_enabled=True)


def test_apply_move_blocked_by_building_when_hitboxes_enabled():
    grid = Grid(width=20, height=20)
    building = Building(building_id="b1", x=11, y=10, size=5)
    assert apply_move(
        grid, 10, 10, "right", buildings=[building], hitboxes_enabled=True
    ) == (10, 10)


def test_apply_move_ignores_building_when_hitboxes_disabled():
    grid = Grid(width=20, height=20)
    building = Building(building_id="b1", x=11, y=10, size=5)
    assert apply_move(
        grid, 10, 10, "right", buildings=[building], hitboxes_enabled=False
    ) == (11, 10)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_movement.py -v`
Expected: FAIL — `TypeError: apply_move() missing 2 required keyword-only arguments`

- [ ] **Step 3: Write the implementation**

```python
from app.world.grid import Grid
from app.world.building import Building
from app.world.collision import is_blocked

DIRECTIONS = {
    "up": (0, -1),
    "right": (1, 0),
    "down": (0, 1),
    "left": (-1, 0),
}


def apply_move(
    grid: Grid,
    x: int,
    y: int,
    direction: str,
    buildings: list[Building],
    hitboxes_enabled: bool,
) -> tuple[int, int]:
    dx, dy = DIRECTIONS[direction]
    new_x, new_y = x + dx, y + dy
    if not grid.in_bounds(new_x, new_y):
        return x, y
    if hitboxes_enabled and is_blocked(new_x, new_y, buildings):
        return x, y
    return new_x, new_y
```

- [ ] **Step 4: Update `main.py`'s call site**

Add `HITBOXES_ENABLED` to the existing config import block in
`backend/app/main.py`. Change the `apply_move(...)` call inside
`websocket_endpoint`:

```python
                    new_x, new_y = apply_move(
                        grid,
                        player.x,
                        player.y,
                        direction,
                        buildings=store.get_buildings(),
                        hitboxes_enabled=HITBOXES_ENABLED,
                    )
```

- [ ] **Step 5: Run the full suite**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/world/movement.py backend/tests/test_movement.py backend/app/main.py
git commit -m "feat: apply_move blocks on building footprints when hitboxes are enabled"
```

---

### Task 8: Villager walk/rest cycle + hitbox-aware auto-walk

**Files:**
- Modify: `backend/app/world/simulation.py`
- Modify: `backend/tests/test_simulation.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `is_blocked` (Task 5), `Store.get_buildings()` (Task 6),
  `WALK_DURATION_SECONDS_MIN/MAX`, `REST_DURATION_SECONDS_MIN/MAX`,
  `TICK_INTERVAL_SECONDS` (Task 1 config).
- Produces: `Simulation.__init__(store, hitboxes_enabled)` — was 1 arg, now
  2. `tick()`'s return shape is unchanged (`list[Agent]`).

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/test_simulation.py` entirely with:

```python
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building
from app.persistence.store import Store
from app.world.simulation import Simulation


def test_tick_moves_single_agent_up_first():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert len(result) == 1
    assert (result[0].x, result[0].y) == (10, 9)


def test_tick_cycles_direction_at_top_edge():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 0)


def test_tick_advances_every_agent_independently():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=10, y=10)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    positions = {agent.id: (agent.x, agent.y) for agent in result}
    assert positions["a1"] == (10, 9)
    assert positions["a2"] == (5, 4)


def test_tick_returns_agents_from_the_store():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert result[0] is store.get_agent("a1")


def test_agent_turns_away_from_building_when_hitboxes_enabled(monkeypatch):
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: 1000)
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    building = Building(building_id="b1", x=9, y=0, size=10)
    store = Store(grid, [agent], player, [building])
    sim = Simulation(store, hitboxes_enabled=True)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 10)


def test_agent_ignores_building_when_hitboxes_disabled(monkeypatch):
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: 1000)
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    building = Building(building_id="b1", x=9, y=0, size=10)
    store = Store(grid, [agent], player, [building])
    sim = Simulation(store, hitboxes_enabled=False)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (10, 9)


def test_agent_does_not_move_while_resting(monkeypatch):
    durations = iter([1, 100])  # initial walk duration 1 tick, then rest duration 100 ticks
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: next(durations))
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    sim.tick()  # walk duration (1) elapses this tick -> switches to resting, no move
    sim.tick()  # resting, 99 ticks left, no move

    assert (store.get_agent("a1").x, store.get_agent("a1").y) == (10, 10)


def test_agent_resumes_walking_after_rest_elapses(monkeypatch):
    durations = iter([1, 1, 100])  # walk 1 tick, rest 1 tick, then walk 100 ticks
    monkeypatch.setattr("app.world.simulation.random.randint", lambda lo, hi: next(durations))
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player, [])
    sim = Simulation(store, hitboxes_enabled=True)

    sim.tick()  # walk(1) elapses -> resting, no move
    sim.tick()  # rest(1) elapses -> walking again, no move (transition tick)
    result = sim.tick()  # now actually walking, moves one step

    assert (result[0].x, result[0].y) == (10, 9)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_simulation.py -v`
Expected: FAIL — `TypeError: Simulation.__init__() missing 1 required keyword-only argument: 'hitboxes_enabled'`

- [ ] **Step 3: Write the implementation**

```python
import random

from app.persistence.store import Store
from app.world.agent import Agent
from app.world.grid import Grid
from app.world.collision import is_blocked
from app.core.config import (
    TICK_INTERVAL_SECONDS,
    WALK_DURATION_SECONDS_MIN,
    WALK_DURATION_SECONDS_MAX,
    REST_DURATION_SECONDS_MIN,
    REST_DURATION_SECONDS_MAX,
)

# up, right, down, left
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]


def _ticks(seconds: float) -> int:
    return max(1, round(seconds / TICK_INTERVAL_SECONDS))


class Simulation:
    def __init__(self, store: Store, hitboxes_enabled: bool):
        self._store = store
        self._hitboxes_enabled = hitboxes_enabled
        self._direction_index = {agent.id: 0 for agent in store.get_agents()}
        self._walking = {agent.id: True for agent in store.get_agents()}
        self._ticks_remaining = {
            agent.id: random.randint(
                _ticks(WALK_DURATION_SECONDS_MIN), _ticks(WALK_DURATION_SECONDS_MAX)
            )
            for agent in store.get_agents()
        }

    def tick(self) -> list[Agent]:
        grid = self._store.get_grid()
        buildings = self._store.get_buildings()
        return [
            self._advance(agent, grid, buildings) for agent in self._store.get_agents()
        ]

    def _advance(self, agent: Agent, grid: Grid, buildings) -> Agent:
        agent_id = agent.id
        self._ticks_remaining[agent_id] -= 1

        if self._ticks_remaining[agent_id] <= 0:
            if self._walking[agent_id]:
                self._walking[agent_id] = False
                self._ticks_remaining[agent_id] = random.randint(
                    _ticks(REST_DURATION_SECONDS_MIN), _ticks(REST_DURATION_SECONDS_MAX)
                )
            else:
                self._walking[agent_id] = True
                self._ticks_remaining[agent_id] = random.randint(
                    _ticks(WALK_DURATION_SECONDS_MIN), _ticks(WALK_DURATION_SECONDS_MAX)
                )
            return self._store.get_agent(agent_id)

        if not self._walking[agent_id]:
            return self._store.get_agent(agent_id)

        for _ in range(len(DIRECTIONS)):
            dx, dy = DIRECTIONS[self._direction_index[agent_id]]
            new_x, new_y = agent.x + dx, agent.y + dy
            blocked = self._hitboxes_enabled and is_blocked(new_x, new_y, buildings)
            if grid.in_bounds(new_x, new_y) and not blocked:
                self._store.set_agent_position(agent_id, new_x, new_y)
                return self._store.get_agent(agent_id)
            self._direction_index[agent_id] = (
                self._direction_index[agent_id] + 1
            ) % len(DIRECTIONS)

        # All directions blocked — stay put.
        return self._store.get_agent(agent_id)
```

- [ ] **Step 4: Update `main.py`'s `Simulation(...)` call**

```python
    simulation = Simulation(store, hitboxes_enabled=HITBOXES_ENABLED)
```

(`HITBOXES_ENABLED` is already imported from Task 7 — no new import needed.)

- [ ] **Step 5: Run the full suite**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/world/simulation.py backend/tests/test_simulation.py backend/app/main.py
git commit -m "feat: villagers alternate walk/rest cycles and turn away from buildings"
```

---

### Task 9: Three villagers + split initial/periodic broadcast payload

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `AGENT_2_START_ID/X/Y`, `AGENT_3_START_ID/X/Y` (Task 1
  config), `Store.get_buildings()` (Task 6).
- Produces: the initial WebSocket message gains a `buildings` key; periodic
  broadcasts keep the existing `{agents, player}` shape unchanged.

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/test_main.py` entirely with:

```python
import json
from fastapi.testclient import TestClient
from app.main import create_app


def test_websocket_sends_initial_state_on_connect():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_text()
            payload = json.loads(data)
            assert payload == {
                "agents": [
                    {"id": "villager-1", "x": 10, "y": 10},
                    {"id": "villager-2", "x": 25, "y": 10},
                    {"id": "villager-3", "x": 10, "y": 25},
                ],
                "player": {"id": "player-1", "x": 5, "y": 5},
                "buildings": [
                    {"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5},
                    {"id": "building-2", "x": 35, "y": 35, "width": 5, "height": 5},
                ],
            }


def test_websocket_applies_valid_move_and_broadcasts_new_state():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 5, "y": 4}
            assert "buildings" not in payload


def test_websocket_ignores_malformed_message_and_still_processes_next_move():
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()  # initial state, ignore

            websocket.send_text("not valid json")
            websocket.send_text(json.dumps({"type": "move", "direction": "up"}))
            data = websocket.receive_text()
            payload = json.loads(data)

            assert payload["player"] == {"id": "player-1", "x": 5, "y": 4}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_main.py -v`
Expected: FAIL — only one villager in the payload, no `buildings` key.

- [ ] **Step 3: Update `main.py`**

Add `AGENT_2_START_ID`, `AGENT_2_START_X`, `AGENT_2_START_Y`,
`AGENT_3_START_ID`, `AGENT_3_START_X`, `AGENT_3_START_Y` to the existing
config import block.

Change the agent list in the `Store(...)` construction:

```python
        [
            Agent(agent_id=AGENT_START_ID, x=AGENT_START_X, y=AGENT_START_Y),
            Agent(agent_id=AGENT_2_START_ID, x=AGENT_2_START_X, y=AGENT_2_START_Y),
            Agent(agent_id=AGENT_3_START_ID, x=AGENT_3_START_X, y=AGENT_3_START_Y),
        ],
```

Add a second payload-building function alongside the existing one:

```python
def _state_payload(agents, player) -> dict:
    return {
        "agents": [agent.to_dict() for agent in agents],
        "player": player.to_dict(),
    }


def _initial_payload(agents, player, buildings) -> dict:
    payload = _state_payload(agents, player)
    payload["buildings"] = [building.to_dict() for building in buildings]
    return payload
```

Change the initial `send_text` call inside `websocket_endpoint` to use it:

```python
            await websocket.send_text(
                json.dumps(
                    _initial_payload(
                        store.get_agents(), store.get_player(), store.get_buildings()
                    )
                )
            )
```

(The periodic broadcasts inside the `while True` loop and inside
`tick_loop` keep calling `_state_payload(...)` exactly as before — no
change there.)

- [ ] **Step 4: Run the full suite**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "feat: three villagers at startup; send buildings once on connect"
```

---

### Task 10: Frontend — parse buildings from the initial message

**Files:**
- Create: `frontend/src/hooks/parseBuildingsMessage.ts`
- Test: `frontend/src/hooks/parseBuildingsMessage.test.ts`

**Interfaces:**
- Produces: `BuildingFootprint {id, x, y, width, height}`,
  `parseBuildingsMessage(raw: string) -> BuildingFootprint[]` — throws on
  malformed input, same pattern as `parsePlayerPosition`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { parseBuildingsMessage } from './parseBuildingsMessage'

describe('parseBuildingsMessage', () => {
  it('parses a valid buildings message', () => {
    const raw =
      '{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}, "buildings": [{"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5}]}'
    expect(parseBuildingsMessage(raw)).toEqual([
      { id: 'building-1', x: 15, y: 15, width: 5, height: 5 },
    ])
  })

  it('parses an empty buildings array', () => {
    const raw = '{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}, "buildings": []}'
    expect(parseBuildingsMessage(raw)).toEqual([])
  })

  it('throws when buildings is missing', () => {
    expect(() =>
      parseBuildingsMessage('{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}}'),
    ).toThrow()
  })

  it('throws when a building entry is missing a field', () => {
    const raw = '{"buildings": [{"id": "building-1", "x": 15, "y": 15, "width": 5}]}'
    expect(() => parseBuildingsMessage(raw)).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseBuildingsMessage('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/parseBuildingsMessage.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```typescript
export interface BuildingFootprint {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function parseBuildingsMessage(raw: string): BuildingFootprint[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.buildings)) {
    throw new Error('Invalid buildings message: "buildings" is not an array')
  }
  return data.buildings.map((entry: unknown): BuildingFootprint => {
    const building = entry as {
      id?: unknown
      x?: unknown
      y?: unknown
      width?: unknown
      height?: unknown
    }
    if (
      typeof building.id !== 'string' ||
      typeof building.x !== 'number' ||
      typeof building.y !== 'number' ||
      typeof building.width !== 'number' ||
      typeof building.height !== 'number'
    ) {
      throw new Error('Invalid building entry: missing id, x, y, width, or height')
    }
    return {
      id: building.id,
      x: building.x,
      y: building.y,
      width: building.width,
      height: building.height,
    }
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/parseBuildingsMessage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/parseBuildingsMessage.ts frontend/src/hooks/parseBuildingsMessage.test.ts
git commit -m "feat: parse buildings from the initial WebSocket message"
```

---

### Task 11: `useGameConnection` gains buildings

**Files:**
- Modify: `frontend/src/hooks/useGameConnection.ts`

**Interfaces:**
- Consumes: `parseBuildingsMessage`, `BuildingFootprint` (Task 10).
- Produces: `GameConnection.buildings: BuildingFootprint[]` — populated
  once from the first message that has a `buildings` key, never updated
  again afterward.

- [ ] **Step 1: Replace the file's contents**

```typescript
import { useEffect, useRef, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'
import { parsePlayerPosition } from './parsePlayerPosition'
import { parseBuildingsMessage, BuildingFootprint } from './parseBuildingsMessage'

export interface GameConnection {
  agents: AgentPosition[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useGameConnection(url: string): GameConnection {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())
  const [player, setPlayer] = useState<AgentPosition | null>(null)
  const [buildings, setBuildings] = useState<BuildingFootprint[]>([])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onmessage = (event) => {
      const incomingAgents = parseAgentsMessage(event.data)
      setAgents((prev) => mergeAgents(prev, incomingAgents))
      setPlayer(parsePlayerPosition(event.data))

      const data = JSON.parse(event.data)
      if (data.buildings !== undefined) {
        setBuildings(parseBuildingsMessage(event.data))
      }
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [url])

  const sendMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'move', direction }))
    }
  }

  return { agents: Array.from(agents.values()), player, buildings, sendMove }
}
```

- [ ] **Step 2: Verify nothing broke**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: all existing tests pass, type check clean. (No dedicated test
file exists for this hook — consistent with phase 1b, which tested the
parse functions directly rather than the hook itself.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGameConnection.ts
git commit -m "feat: useGameConnection exposes buildings from the initial message"
```

---

### Task 12: Frontend rendering — bigger grid, buildings, edge border, camera

**Files:**
- Modify: `frontend/src/scene/AgentScene.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `BuildingFootprint` (Task 10), `buildings` from
  `useGameConnection` (Task 11).
- Produces: `AgentScene` gains a `buildings` prop.

- [ ] **Step 1: Replace `frontend/src/scene/AgentScene.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'
import { BuildingFootprint } from '../hooks/parseBuildingsMessage'

const GRID_SIZE = 50

interface AgentSceneProps {
  agents: AgentPosition[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
}

export function AgentScene({ agents, player, buildings }: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)
  const buildingMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    )
    camera.position.set(GRID_SIZE / 2, GRID_SIZE * 0.8, GRID_SIZE * 1.3)
    camera.lookAt(GRID_SIZE / 2, 0, GRID_SIZE / 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    mount.appendChild(renderer.domElement)

    const handleResize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x3a5a40 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2)
    scene.add(ground)

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000)
    gridHelper.position.set(GRID_SIZE / 2, 0.01, GRID_SIZE / 2)
    scene.add(gridHelper)

    const borderPoints = [
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(GRID_SIZE, 0.02, 0),
      new THREE.Vector3(GRID_SIZE, 0.02, GRID_SIZE),
      new THREE.Vector3(0, 0.02, GRID_SIZE),
      new THREE.Vector3(0, 0.02, 0),
    ]
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints)
    const border = new THREE.Line(
      borderGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    )
    scene.add(border)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    scene.add(directionalLight)

    let frameId: number
    const animate = () => {
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      meshesRef.current.clear()
      playerMeshRef.current = null
      buildingMeshesRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const seenIds = new Set(agents.map((agent) => agent.id))

    for (const [id, mesh] of meshesRef.current) {
      if (!seenIds.has(id)) {
        scene.remove(mesh)
        meshesRef.current.delete(id)
      }
    }

    for (const agent of agents) {
      let mesh = meshesRef.current.get(agent.id)
      if (!mesh) {
        const geometry = new THREE.IcosahedronGeometry(0.4, 0)
        const material = new THREE.MeshStandardMaterial({ color: 0xe8a87c })
        mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
        meshesRef.current.set(agent.id, mesh)
      }
      mesh.position.set(agent.x + 0.5, 0.5, agent.y + 0.5)
    }
  }, [agents])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (!player) {
      if (playerMeshRef.current) {
        scene.remove(playerMeshRef.current)
        playerMeshRef.current = null
      }
      return
    }

    let mesh = playerMeshRef.current
    if (!mesh) {
      const geometry = new THREE.TetrahedronGeometry(0.5, 0)
      const material = new THREE.MeshStandardMaterial({ color: 0xffff00 })
      mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)
      playerMeshRef.current = mesh
    }
    mesh.position.set(player.x + 0.5, 0.5, player.y + 0.5)
  }, [player])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    for (const building of buildings) {
      if (buildingMeshesRef.current.has(building.id)) continue
      const geometry = new THREE.BoxGeometry(building.width, 2, building.height)
      const material = new THREE.MeshStandardMaterial({ color: 0x808080 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(
        building.x + building.width / 2,
        1,
        building.y + building.height / 2,
      )
      scene.add(mesh)
      buildingMeshesRef.current.set(building.id, mesh)
    }
  }, [buildings])

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}
```

- [ ] **Step 2: Replace `frontend/src/App.tsx`**

```tsx
import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { AgentScene } from './scene/AgentScene'

function App() {
  const { agents, player, buildings, sendMove } = useGameConnection('ws://localhost:8420/ws')
  useKeyboardMovement(sendMove)
  return <AgentScene agents={agents} player={player} buildings={buildings} />
}

export default App
```

- [ ] **Step 3: Verify nothing broke**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: all tests pass, type check clean.

- [ ] **Step 4: Manual visual verification**

Start both servers and open the app in a real browser. Confirm: the board
reads as noticeably bigger, three villager shapes are visible and
auto-walking (with visible rest pauses over a few minutes), two gray boxes
sit at their configured positions, a white border traces the grid's edge,
and — with `HITBOXES_ENABLED = True` — walking or moving the player into a
building's footprint is blocked (turns away for villagers, stays in place
for the player).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/scene/AgentScene.tsx frontend/src/App.tsx
git commit -m "feat: render buildings, bigger grid, grid-edge border, repositioned camera"
```
