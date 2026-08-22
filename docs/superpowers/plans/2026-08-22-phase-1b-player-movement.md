# Phase 1b: Player-Controlled Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **HARD RULE (see `~/.claude/CLAUDE.md`):** No code file gets written before the user has seen and explicitly approved it, one file at a time. Never move to the next task's file without an explicit yes on the current one.

**Goal:** A player-controlled character, distinct from the auto-walking villager, that moves one tile per keypress and is visible live to every connected browser, over the same WebSocket connection phase 1a built (now made two-way).

**Architecture:** The backend's WebSocket, one-way in phase 1a, becomes two-way: it still pushes state out on every change, and now also listens for `{"type": "move", "direction": "..."}` commands. A new `Player` — same shape as `Agent` (`{id, x, y}`), but tracked separately — moves immediately when a valid command arrives, reusing the same `Grid.in_bounds()` check the villager already uses. The frontend gains a keyboard listener that sends move commands and renders the player as a distinct yellow tetrahedron alongside the villager's existing shape.

**Tech Stack:** Same as phase 1a — Python 3.11+, FastAPI, uvicorn, pytest (backend); Vite, React 18, TypeScript, Three.js, Vitest (frontend). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-phase-1b-player-movement-design.md`

## Global Constraints

- `Player` is a distinct concept from `Agent`, not another villager — `{id, x, y}`, exactly one global player, shared by however many browsers are connected.
- Movement commands travel over the same WebSocket connection used for outgoing state — no new REST endpoint.
- Player movement is immediate on keypress, not synced to the villager's 0.5s tick cadence.
- 4-directional only (up/down/left/right), no diagonals — reuses `Grid.in_bounds()`.
- An out-of-bounds move command is ignored — the player simply doesn't move that step (no direction-cycling; that's specific to the villager's scripted auto-walk).
- Malformed/unrecognized incoming messages are ignored, never crash the connection.
- Camera stays fixed (unchanged from phase 1a) — no camera-follow logic.
- No shared `Entity` base class for `Agent`/`Player` this phase — two small separate classes, noted in `IDEAS.md` for whenever buildings/hitboxes are designed for real.
- Player id/start position come from named config constants, matching exactly how `Agent`'s config already works.
- Out of scope entirely: multiple simultaneous players, collision/hitboxes, dialogue, the canvas-sizing/white-edges rendering bug (tracked separately, unrelated).

---

## File Structure

```
backend/
  app/
    core/config.py          # + PLAYER_START_ID/X/Y constants
    world/
      player.py              # new: Player schema
      movement.py             # new: apply_move() — bounds-checked movement
    api/
      messages.py             # new: parse_move_command()
    persistence/store.py      # modified: holds a Player too
    main.py                   # modified: create_app() factory, bidirectional /ws
  tests/
    test_player.py            # new
    test_movement.py          # new
    test_messages.py          # new
    test_store.py             # modified: Store(...) calls need a player arg
    test_simulation.py        # modified: same ripple, Store(...) calls need a player arg
    test_main.py              # modified: new payload shape, new move-handling tests
frontend/
  src/
    hooks/
      parsePlayerPosition.ts       # new
      parsePlayerPosition.test.ts  # new
      useGameConnection.ts         # new, replaces useAgentPositions.ts
      useKeyboardMovement.ts       # new
    scene/
      AgentScene.tsx           # modified: renders the player as a yellow tetrahedron
    App.tsx                    # modified: final wiring
```

---

### Task 1: Player schema

**Files:**
- Modify: `backend/app/world/player.py`
- Test: `backend/tests/test_player.py`

**Interfaces:**
- Produces: `Player(player_id: str, x: int, y: int)` with `.id`, `.x`, `.y`, and `.to_dict() -> dict` returning `{"id": str, "x": int, "y": int}`. Deliberately identical shape to `Agent` (per this session's "let's be consistent" decision) — kept as a separate class rather than inheriting a shared base, since the only overlap today is these three fields.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_player.py
from app.world.player import Player


def test_player_stores_id_and_position():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.id == "player-1"
    assert player.x == 3
    assert player.y == 7


def test_player_to_dict():
    player = Player(player_id="player-1", x=3, y=7)
    assert player.to_dict() == {"id": "player-1", "x": 3, "y": 7}
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `pytest tests/test_player.py -v`
Expected: FAIL — `Player` not defined (the file is currently empty).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/world/player.py
class Player:
    def __init__(self, player_id: str, x: int, y: int):
        self.id = player_id
        self.x = x
        self.y = y

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/player.py backend/tests/test_player.py
git commit -m "feat: add Player schema"
```

---

### Task 2: Store extended to hold a Player

**Files:**
- Modify: `backend/app/persistence/store.py`
- Modify: `backend/tests/test_store.py`
- Modify: `backend/tests/test_simulation.py`

**Interfaces:**
- Consumes: `Player` from `app.world.player` (Task 1).
- Produces: `Store(grid: Grid, agents: list[Agent], player: Player)` — constructor signature changes from phase 1a's two-argument form to three arguments. New methods: `.get_player() -> Player`, `.set_player_position(x: int, y: int) -> None`.

**Why `test_simulation.py` is touched by this task:** `Store`'s constructor signature is changing (a required third argument). `test_simulation.py` constructs `Store` directly in every test, so those calls need updating to keep passing — this is a mechanical ripple from Task 2's own change, not new Simulation behavior. `Simulation` itself is untouched; it never reads `Player` and doesn't need to.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_store.py
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.persistence.store import Store


def test_get_grid_returns_the_grid():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player)
    assert store.get_grid() is grid


def test_get_agents_returns_all_agents_in_order():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player)
    assert store.get_agents() == [agent1, agent2]


def test_get_agent_by_id():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player)
    assert store.get_agent("a1") is agent


def test_set_agent_position_updates_only_the_targeted_agent():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player)

    store.set_agent_position("a1", 9, 9)

    assert store.get_agent("a1").x == 9
    assert store.get_agent("a1").y == 9
    assert store.get_agent("a2").x == 5
    assert store.get_agent("a2").y == 5


def test_get_player_returns_the_player():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=2, y=2)
    store = Store(grid, [agent], player)
    assert store.get_player() is player


def test_set_player_position_updates_the_player_only():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    player = Player(player_id="p1", x=2, y=2)
    store = Store(grid, [agent], player)

    store.set_player_position(9, 9)

    assert store.get_player().x == 9
    assert store.get_player().y == 9
    assert store.get_agent("a1").x == 0
    assert store.get_agent("a1").y == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `pytest tests/test_store.py -v`
Expected: FAIL — `Store.__init__()` doesn't accept a `player` argument yet (`TypeError`).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/persistence/store.py
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player


class Store:
    def __init__(self, grid: Grid, agents: list[Agent], player: Player):
        self._grid = grid
        self._agents = {agent.id: agent for agent in agents}
        self._player = player

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_store.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Fix the ripple in test_simulation.py**

```python
# backend/tests/test_simulation.py
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.persistence.store import Store
from app.world.simulation import Simulation


def test_tick_moves_single_agent_up_first():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player)
    sim = Simulation(store)

    result = sim.tick()

    assert len(result) == 1
    assert (result[0].x, result[0].y) == (10, 9)


def test_tick_cycles_direction_at_top_edge():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=0)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player)
    sim = Simulation(store)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 0)


def test_tick_advances_every_agent_independently():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=10, y=10)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent1, agent2], player)
    sim = Simulation(store)

    result = sim.tick()

    positions = {agent.id: (agent.x, agent.y) for agent in result}
    assert positions["a1"] == (10, 9)
    assert positions["a2"] == (5, 4)


def test_tick_returns_agents_from_the_store():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    player = Player(player_id="p1", x=0, y=0)
    store = Store(grid, [agent], player)
    sim = Simulation(store)

    result = sim.tick()

    assert result[0] is store.get_agent("a1")
```

- [ ] **Step 6: Run the full backend test suite**

Run: `pytest -v`
Expected: PASS (all tests, including `test_store.py` and `test_simulation.py`)

- [ ] **Step 7: Commit**

```bash
git add backend/app/persistence/store.py backend/tests/test_store.py backend/tests/test_simulation.py
git commit -m "feat: extend Store to hold a Player alongside agents"
```

---

### Task 3: Movement helper

**Files:**
- Modify: `backend/app/world/movement.py`
- Test: `backend/tests/test_movement.py`

**Interfaces:**
- Consumes: `Grid` from `app.world.grid` (phase 1a), specifically `.in_bounds(x, y)`.
- Produces: `apply_move(grid: Grid, x: int, y: int, direction: str) -> tuple[int, int]` — `direction` is one of `"up" | "down" | "left" | "right"`. Returns the new position if the move is legal, or the unchanged input position if it would go out of bounds. Never raises for the four valid directions.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_movement.py
from app.world.grid import Grid
from app.world.movement import apply_move


def test_apply_move_up_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "up") == (10, 9)


def test_apply_move_right_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "right") == (11, 10)


def test_apply_move_down_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "down") == (10, 11)


def test_apply_move_left_moves_within_bounds():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 10, "left") == (9, 10)


def test_apply_move_blocked_at_top_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 10, 0, "up") == (10, 0)


def test_apply_move_blocked_at_left_edge_stays_in_place():
    grid = Grid(width=20, height=20)
    assert apply_move(grid, 0, 10, "left") == (0, 10)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_movement.py -v`
Expected: FAIL — `apply_move` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/world/movement.py
from app.world.grid import Grid

DIRECTIONS = {
    "up": (0, -1),
    "right": (1, 0),
    "down": (0, 1),
    "left": (-1, 0),
}


def apply_move(grid: Grid, x: int, y: int, direction: str) -> tuple[int, int]:
    dx, dy = DIRECTIONS[direction]
    new_x, new_y = x + dx, y + dy
    if grid.in_bounds(new_x, new_y):
        return new_x, new_y
    return x, y
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_movement.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/movement.py backend/tests/test_movement.py
git commit -m "feat: add apply_move bounds-checked movement helper"
```

---

### Task 4: Move-command message parsing

**Files:**
- Modify: `backend/app/api/messages.py`
- Test: `backend/tests/test_messages.py`

**Interfaces:**
- Produces: `parse_move_command(raw: str) -> str | None`. Returns one of `"up" | "down" | "left" | "right"` if `raw` is a valid `{"type": "move", "direction": "..."}` JSON message, otherwise `None` — never raises, regardless of how malformed `raw` is.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_messages.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_messages.py -v`
Expected: FAIL — `parse_move_command` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/api/messages.py
import json

VALID_DIRECTIONS = {"up", "down", "left", "right"}


def parse_move_command(raw: str) -> str | None:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(data, dict):
        return None

    if data.get("type") != "move":
        return None

    direction = data.get("direction")
    if direction not in VALID_DIRECTIONS:
        return None

    return direction
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_messages.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/messages.py backend/tests/test_messages.py
git commit -m "feat: add parse_move_command for incoming WebSocket messages"
```

---

### Task 5: FastAPI app wiring — bidirectional WebSocket

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `Player` (Task 1), `Store` with player support (Task 2), `apply_move` (Task 3), `parse_move_command` (Task 4).
- Produces: `create_app() -> FastAPI` — a factory function that builds a fresh, isolated app (its own `Store`/`Simulation`/`ConnectionManager`) each time it's called. Module-level `app = create_app()` still exists for `uvicorn app.main:app` to run normally. The `/ws` route sends `{"agents": [...], "player": {...}}` on connect, applies incoming move commands immediately with a broadcast, and the tick loop broadcasts the same combined shape on its own schedule.

**Why `create_app()` instead of module-level globals (like phase 1a's `main.py` had):** phase 1a's final review flagged that `store`/`simulation`/`manager` being created once at import time means any test that mutates state (like a move command changing the player's position) leaks into every other test in the file, since they'd all share the same objects — explicitly noting this would bite "before phase 1b adds more main.py tests." This task adds two such tests, so the factory function is built now rather than shipping a known-fragile pattern.

- [ ] **Step 1: Add player config constants**

```python
# backend/app/core/config.py
GRID_WIDTH = 20
GRID_HEIGHT = 20
AGENT_START_ID = "villager-1"
AGENT_START_X = 10
AGENT_START_Y = 10
TICK_INTERVAL_SECONDS = 0.5
PLAYER_START_ID = "player-1"
PLAYER_START_X = 5
PLAYER_START_Y = 5
```

- [ ] **Step 2: Write the failing tests**

```python
# backend/tests/test_main.py
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
                "agents": [{"id": "villager-1", "x": 10, "y": 10}],
                "player": {"id": "player-1", "x": 5, "y": 5},
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

This third test proves malformed messages don't crash the connection or trigger a stray broadcast — the only broadcast received after the initial state is the one from the one valid "up" command that follows the malformed one. Each test calls `create_app()` itself, so none of these three tests can see another's mutations.

- [ ] **Step 3: Run tests to verify they fail**

Run (from `backend/`): `pytest tests/test_main.py -v`
Expected: FAIL — `create_app` not defined, and the payload shape doesn't include `"player"` yet.

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/main.py
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

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
)
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.simulation import Simulation
from app.world.movement import apply_move
from app.persistence.store import Store
from app.api.websocket import ConnectionManager
from app.api.messages import parse_move_command

logger = logging.getLogger(__name__)


def _state_payload(agents, player) -> dict:
    return {
        "agents": [agent.to_dict() for agent in agents],
        "player": player.to_dict(),
    }


def create_app() -> FastAPI:
    store = Store(
        Grid(GRID_WIDTH, GRID_HEIGHT),
        [Agent(agent_id=AGENT_START_ID, x=AGENT_START_X, y=AGENT_START_Y)],
        Player(player_id=PLAYER_START_ID, x=PLAYER_START_X, y=PLAYER_START_Y),
    )
    simulation = Simulation(store)
    manager = ConnectionManager()

    async def tick_loop():
        while True:
            await asyncio.sleep(TICK_INTERVAL_SECONDS)
            try:
                agents = simulation.tick()
                await manager.broadcast(_state_payload(agents, store.get_player()))
            except Exception:
                logger.exception("tick_loop failed on this tick")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(tick_loop())
        yield
        task.cancel()

    app = FastAPI(lifespan=lifespan)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        await websocket.send_text(
            json.dumps(_state_payload(store.get_agents(), store.get_player()))
        )
        try:
            while True:
                raw = await websocket.receive_text()
                direction = parse_move_command(raw)
                if direction is not None:
                    grid = store.get_grid()
                    player = store.get_player()
                    new_x, new_y = apply_move(grid, player.x, player.y, direction)
                    store.set_player_position(new_x, new_y)
                    await manager.broadcast(
                        _state_payload(store.get_agents(), store.get_player())
                    )
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    return app


app = create_app()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_main.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend test suite**

Run: `pytest -v`
Expected: PASS (all tests across every task so far)

- [ ] **Step 7: Manually verify the server runs**

Run: `uvicorn app.main:app --reload --port 8420`
Expected: server starts without errors; `http://localhost:8420/docs` loads.

Leave this running — it's needed for Task 10's end-to-end check. (If you need to stop it first, that's fine — just note it needs to be running again for Task 10.)

- [ ] **Step 8: Commit**

```bash
git add backend/app/core/config.py backend/app/main.py backend/tests/test_main.py
git commit -m "feat: make WebSocket bidirectional, wire Player movement end to end"
```

---

### Task 6: Frontend — parse the player field

**Files:**
- Modify: `frontend/src/hooks/parsePlayerPosition.ts`
- Test: `frontend/src/hooks/parsePlayerPosition.test.ts`

**Interfaces:**
- Consumes: `AgentPosition` type from `frontend/src/hooks/parseAgentsMessage.ts` (phase 1a) — reused as-is for the player, since the shapes are identical (`{id, x, y}`).
- Produces: `parsePlayerPosition(raw: string): AgentPosition` — reads the `player` field out of the same raw WebSocket message text `parseAgentsMessage` also reads (both parse the same message independently; this keeps `parseAgentsMessage` and the already-tested `mergeAgents` completely untouched). Throws if `player` is missing or malformed.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/parsePlayerPosition.test.ts
import { describe, it, expect } from 'vitest'
import { parsePlayerPosition } from './parsePlayerPosition'

describe('parsePlayerPosition', () => {
  it('parses a valid player message', () => {
    const raw = '{"agents": [], "player": {"id": "player-1", "x": 5, "y": 5}}'
    expect(parsePlayerPosition(raw)).toEqual({ id: 'player-1', x: 5, y: 5 })
  })

  it('throws when player is missing', () => {
    expect(() => parsePlayerPosition('{"agents": []}')).toThrow()
  })

  it('throws when the player entry is missing a field', () => {
    const raw = '{"agents": [], "player": {"id": "player-1", "x": 5}}'
    expect(() => parsePlayerPosition(raw)).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parsePlayerPosition('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test`
Expected: FAIL — `parsePlayerPosition.ts` has no exports (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// frontend/src/hooks/parsePlayerPosition.ts
import { AgentPosition } from './parseAgentsMessage'

export function parsePlayerPosition(raw: string): AgentPosition {
  const data = JSON.parse(raw)
  const player = data.player as { id?: unknown; x?: unknown; y?: unknown } | undefined
  if (
    !player ||
    typeof player.id !== 'string' ||
    typeof player.x !== 'number' ||
    typeof player.y !== 'number'
  ) {
    throw new Error('Invalid player entry: missing id, x, or y')
  }
  return { id: player.id, x: player.x, y: player.y }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (4 new tests, plus all existing tests still passing)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/parsePlayerPosition.ts frontend/src/hooks/parsePlayerPosition.test.ts
git commit -m "feat: add parsePlayerPosition for the player field in WebSocket messages"
```

---

### Task 7: Frontend — two-way WebSocket connection

**Files:**
- Create: `frontend/src/hooks/useGameConnection.ts`
- Delete: `frontend/src/hooks/useAgentPositions.ts`

**Interfaces:**
- Consumes: `parseAgentsMessage` + `AgentPosition` (phase 1a, `parseAgentsMessage.ts`), `mergeAgents` (phase 1a, `mergeAgents.ts`), `parsePlayerPosition` (Task 6).
- Produces: `useGameConnection(url: string): { agents: AgentPosition[], player: AgentPosition | null, sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void }`. Not unit tested — same reasoning as phase 1a's `useAgentPositions`: it's a thin wrapper over the browser's WebSocket API and the already-tested `parseAgentsMessage`/`mergeAgents`/`parsePlayerPosition`, verified manually in Task 10.

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/hooks/useGameConnection.ts
import { useEffect, useRef, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'
import { parsePlayerPosition } from './parsePlayerPosition'

export interface GameConnection {
  agents: AgentPosition[]
  player: AgentPosition | null
  sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useGameConnection(url: string): GameConnection {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())
  const [player, setPlayer] = useState<AgentPosition | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onmessage = (event) => {
      const incomingAgents = parseAgentsMessage(event.data)
      setAgents((prev) => mergeAgents(prev, incomingAgents))
      setPlayer(parsePlayerPosition(event.data))
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [url])

  const sendMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    socketRef.current?.send(JSON.stringify({ type: 'move', direction }))
  }

  return { agents: Array.from(agents.values()), player, sendMove }
}
```

- [ ] **Step 2: Delete the old hook**

```bash
rm frontend/src/hooks/useAgentPositions.ts
```

- [ ] **Step 3: Run the full frontend test suite**

Run (from `frontend/`): `npm run test`
Expected: PASS (all existing tests still pass — this task adds no new tests). Note: `App.tsx` still imports the now-deleted `useAgentPositions` at this point in the plan — that's expected and harmless here, since Vitest only runs test files and what they import, not `App.tsx` itself. `App.tsx` gets rewired in Task 10; don't fix it early.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useGameConnection.ts
git add -u frontend/src/hooks/useAgentPositions.ts
git commit -m "feat: replace useAgentPositions with two-way useGameConnection"
```

---

### Task 8: Frontend — keyboard input

**Files:**
- Create: `frontend/src/hooks/useKeyboardMovement.ts`

**Interfaces:**
- Produces: `useKeyboardMovement(onMove: (direction: 'up' | 'down' | 'left' | 'right') => void): void`. Not unit tested — a thin wrapper over browser keyboard events, verified manually in Task 10.

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/hooks/useKeyboardMovement.ts
import { useEffect } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

export function useKeyboardMovement(onMove: (direction: Direction) => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key]
      if (direction) {
        onMove(direction)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onMove])
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useKeyboardMovement.ts
git commit -m "feat: add useKeyboardMovement for arrow key / WASD input"
```

---

### Task 9: Frontend — render the player

**Files:**
- Modify: `frontend/src/scene/AgentScene.tsx`

**Interfaces:**
- Consumes: `AgentPosition` type (phase 1a, `parseAgentsMessage.ts`).
- Produces: `AgentScene` gains a new `player: AgentPosition | null` prop alongside its existing `agents` prop, rendering the player as a single yellow `TetrahedronGeometry` mesh using the same create-on-first-appearance / update-position pattern already used for villager meshes, plus removal if `player` ever becomes `null`.

No unit test — same reasoning as phase 1a's Three.js rendering code: visual correctness gets checked by actually looking at it, not by an automated test. Verification is a manual step below.

- [ ] **Step 1: Add the player prop and rendering effect**

```tsx
// frontend/src/scene/AgentScene.tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'

const GRID_SIZE = 20

interface AgentSceneProps {
  agents: AgentPosition[]
  player: AgentPosition | null
}

export function AgentScene({ agents, player }: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)

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
    camera.position.set(GRID_SIZE / 2, 15, GRID_SIZE + 5)
    camera.lookAt(GRID_SIZE / 2, 0, GRID_SIZE / 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

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
      cancelAnimationFrame(frameId)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      meshesRef.current.clear()
      playerMeshRef.current = null
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

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}
```

- [ ] **Step 2: Temporarily verify the player mesh renders**

Same throwaway manual-check pattern phase 1a used for this file. Temporarily edit `frontend/src/App.tsx`:

```tsx
import { AgentScene } from './scene/AgentScene'

function App() {
  return (
    <AgentScene
      agents={[{ id: 'a1', x: 5, y: 5 }]}
      player={{ id: 'player-1', x: 10, y: 10 }}
    />
  )
}

export default App
```

Run: `npm run dev`, open the browser.
Expected: the villager's rounded tan shape, plus a distinct yellow four-faced (tetrahedron) shape at a different tile.

- [ ] **Step 3: Revert the temporary App.tsx edit**

```bash
git checkout frontend/src/App.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/scene/AgentScene.tsx
git commit -m "feat: render the player as a yellow tetrahedron in AgentScene"
```

---

### Task 10: Final wiring — player movement end to end

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useGameConnection` (Task 7), `useKeyboardMovement` (Task 8), `AgentScene` with its `player` prop (Task 9).

- [ ] **Step 1: Wire everything together**

```tsx
// frontend/src/App.tsx
import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { AgentScene } from './scene/AgentScene'

function App() {
  const { agents, player, sendMove } = useGameConnection('ws://localhost:8420/ws')
  useKeyboardMovement(sendMove)
  return <AgentScene agents={agents} player={player} />
}

export default App
```

- [ ] **Step 2: Run the full frontend test suite**

Run (from `frontend/`): `npm run test`
Expected: PASS (all tests from Tasks 6 onward, plus everything from phase 1a)

- [ ] **Step 3: End-to-end manual verification**

Terminal 1 (from `backend/`, venv activated):
```bash
uvicorn app.main:app --reload --port 8420
```

Terminal 2 (from `frontend/`):
```bash
npm run dev
```

Open the printed frontend URL.

Expected, matching this phase's definition of done:
- Pressing an arrow key (or WASD) moves the yellow tetrahedron one tile in that direction, immediately, with zero manual refresh.
- Holding a key down keeps moving it, one tile per repeat-fire.
- The player cannot walk off the edge of the board — pressing a direction that would leave the grid simply does nothing.
- The villager (rounded tan shape) keeps auto-walking on its own, completely unaffected by player input.
- Both shapes are visible at once and clearly distinguishable.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire player movement end to end"
```

---

## Self-Review Notes

- **Spec coverage:** Player as a distinct concept (`{id, x, y}`) → Task 1. Store holding both → Task 2. Bounds-checked movement reusing `Grid.in_bounds()` → Task 3. WebSocket becoming bidirectional, move commands, immediate broadcast, malformed-message handling → Tasks 4-5. Villager tick loop untouched/independent → Task 5 (unchanged `Simulation`/`tick_loop` call site, just now also broadcasting player state alongside it). Frontend: parsing the player field, two-way connection, keyboard input, distinct yellow-tetrahedron rendering, fixed camera (untouched) → Tasks 6-10. Definition of done → Task 10 Step 3. Config constants matching `Agent`'s pattern → Task 5 Step 1. No shared `Entity` base class → not built, matches spec.
- **Placeholder scan:** no TBD/TODO; every step has real code or a real command.
- **Type consistency:** `Player.to_dict()` returns `{"id", "x", "y"}`, consumed identically to `Agent.to_dict()` in `_state_payload`. `Store.get_player()` / `.set_player_position(x, y)` signatures match between Task 2's definition and Task 5's usage in the `/ws` handler. `apply_move(grid, x, y, direction) -> tuple[int, int]` signature matches between Task 3's definition and Task 5's call site. `parse_move_command(raw) -> str | None` matches between Task 4's definition and Task 5's usage. On the frontend: `AgentPosition` (phase 1a) reused as-is for the player everywhere — Task 6, 7, 9, 10 — no duplicate `PlayerPosition` type introduced. `GameConnection`'s `{agents, player, sendMove}` shape from Task 7 matches exactly how Task 10's `App.tsx` destructures it.
- **Cross-task ripple check:** `Store`'s constructor signature change (Task 2) is the one change with ripple beyond its own task — confirmed both existing call sites that construct `Store` directly (`test_store.py`, `test_simulation.py`) are updated within Task 2 itself, and the one remaining call site (`main.py`) is naturally rewritten in Task 5 anyway. No other task's signature changes ripple beyond what that same task already updates.
