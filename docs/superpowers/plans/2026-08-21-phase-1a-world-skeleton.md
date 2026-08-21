# Phase 1a: World Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **HARD RULE (see `~/.claude/CLAUDE.md`):** No code file gets written before the user has seen and explicitly approved it, one file at a time. Never move to the next task's file without an explicit yes on the current one.

**Goal:** A backend that owns a grid and a *collection* of agents (starting with exactly one), ticks their positions on a timer, and streams live updates to a Three.js frontend that renders each agent as a moving 3D low-poly shape.

**Architecture:** Python/FastAPI backend owns all simulation state and runs an async tick loop; a WebSocket endpoint broadcasts the full agent list every tick. React/Three.js frontend is a pure renderer — it holds no authoritative state, just draws whatever the backend sends. Every data shape (backend `Store`, `Simulation`, the WebSocket payload, and the frontend hook/scene) is collection-based from the start — a list/map keyed by agent id — even though this phase ships exactly one agent. Adding agent #2 later is adding one entry to a list in `main.py`; nothing else changes.

**Tech Stack:** Backend: Python 3.11+, FastAPI, uvicorn, pytest. Frontend: Vite, React 18, TypeScript, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-phase-1a-world-skeleton-design.md`

## Global Constraints

- Discrete grid movement, 4-directional only (up/down/left/right), no diagonals.
- Phase 1a ships exactly one agent — but agents are modeled as a collection (`list[Agent]` on the backend, `AgentPosition[]` on the frontend) from the start, specifically so a second/third agent later requires no restructuring. No zones, no player-controlled movement, no dialogue, no roles, no memory, no LLM calls anywhere in this phase.
- State lives in memory in the backend process only — no database, resets on restart.
- Renderer is Three.js, not PixiJS/Phaser — low-poly/retro-polygon aesthetic, not pixel art, built from Three's primitive geometries with its built-in lighting (no custom shaders).
- Camera is perspective (not orthographic).
- Backend/frontend stay fully separated — frontend never computes state, only renders it.

---

## File Structure

```
backend/
  requirements.txt
  pytest.ini
  app/
    main.py
    core/config.py
    world/grid.py
    world/agent.py
    world/simulation.py
    api/websocket.py
    persistence/store.py
  tests/
    test_grid.py
    test_agent.py
    test_store.py
    test_simulation.py
    test_websocket.py
    test_main.py
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    hooks/parseAgentsMessage.ts
    hooks/parseAgentsMessage.test.ts
    hooks/useAgentPositions.ts
    scene/AgentScene.tsx
```

---

### Task 1: Backend project setup

**Files:**
- Create: `backend/requirements.txt`

**Interfaces:**
- Produces: an installable Python environment with `fastapi`, `uvicorn[standard]`, and `pytest` available for every later backend task.

- [ ] **Step 1: Write requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

(`httpx` is required by FastAPI's `TestClient`, used in Task 7. `pytest-asyncio` is required by Task 6's async tests — included here upfront so there's only one install step.)

- [ ] **Step 2: Create and activate a virtual environment, install dependencies**

Run:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 3: Verify install**

Run: `python3 -c "import fastapi, uvicorn, pytest, pytest_asyncio; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Configure pytest-asyncio**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini
git commit -m "chore: add backend dependencies"
```

---

### Task 2: Grid schema

**Files:**
- Modify: `backend/app/world/grid.py`
- Test: `backend/tests/test_grid.py`

**Interfaces:**
- Produces: `Grid(width: int, height: int)` with `.width`, `.height`, and `.in_bounds(x: int, y: int) -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_grid.py
from app.world.grid import Grid


def test_in_bounds_true_for_position_inside_grid():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(5, 5) is True


def test_in_bounds_true_for_origin():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(0, 0) is True


def test_in_bounds_false_for_negative_position():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(-1, 5) is False


def test_in_bounds_false_at_width_edge():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(20, 5) is False


def test_in_bounds_true_at_last_valid_column():
    grid = Grid(width=20, height=20)
    assert grid.in_bounds(19, 5) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `pytest tests/test_grid.py -v`
Expected: FAIL — `ImportError` or `ModuleNotFoundError: No module named 'app.world.grid'` (or `Grid` not defined, since the file is currently empty).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/world/grid.py
class Grid:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_grid.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/grid.py backend/tests/test_grid.py
git commit -m "feat: add Grid schema with bounds checking"
```

---

### Task 3: Agent schema

**Files:**
- Modify: `backend/app/world/agent.py`
- Test: `backend/tests/test_agent.py`

**Interfaces:**
- Produces: `Agent(agent_id: str, x: int, y: int)` with `.id`, `.x`, `.y`, and `.to_dict() -> dict` returning `{"id": str, "x": int, "y": int}`. `.id` is what makes agents addressable individually once there's more than one.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_agent.py
from app.world.agent import Agent


def test_agent_stores_id_and_position():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.id == "villager-1"
    assert agent.x == 3
    assert agent.y == 7


def test_agent_to_dict():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.to_dict() == {"id": "villager-1", "x": 3, "y": 7}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agent.py -v`
Expected: FAIL — `Agent` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/world/agent.py
class Agent:
    def __init__(self, agent_id: str, x: int, y: int):
        self.id = agent_id
        self.x = x
        self.y = y

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_agent.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/agent.py backend/tests/test_agent.py
git commit -m "feat: add Agent schema with id"
```

---

### Task 4: Persistence store

**Files:**
- Modify: `backend/app/persistence/store.py`
- Test: `backend/tests/test_store.py`

**Interfaces:**
- Consumes: `Grid` from `app.world.grid` (Task 2), `Agent` from `app.world.agent` (Task 3).
- Produces: `Store(grid: Grid, agents: list[Agent])` with `.get_grid() -> Grid`, `.get_agents() -> list[Agent]`, `.get_agent(agent_id: str) -> Agent`, `.set_agent_position(agent_id: str, x: int, y: int) -> None`. Takes a **list** of agents at construction — this is the seam that makes a second agent later just another list entry.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_store.py
from app.world.grid import Grid
from app.world.agent import Agent
from app.persistence.store import Store


def test_get_grid_returns_the_grid():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    store = Store(grid, [agent])
    assert store.get_grid() is grid


def test_get_agents_returns_all_agents_in_order():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    store = Store(grid, [agent1, agent2])
    assert store.get_agents() == [agent1, agent2]


def test_get_agent_by_id():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=0, y=0)
    store = Store(grid, [agent])
    assert store.get_agent("a1") is agent


def test_set_agent_position_updates_only_the_targeted_agent():
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=0, y=0)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    store = Store(grid, [agent1, agent2])

    store.set_agent_position("a1", 9, 9)

    assert store.get_agent("a1").x == 9
    assert store.get_agent("a1").y == 9
    assert store.get_agent("a2").x == 5
    assert store.get_agent("a2").y == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_store.py -v`
Expected: FAIL — `Store` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/persistence/store.py
from app.world.grid import Grid
from app.world.agent import Agent


class Store:
    def __init__(self, grid: Grid, agents: list[Agent]):
        self._grid = grid
        self._agents = {agent.id: agent for agent in agents}

    def get_grid(self) -> Grid:
        return self._grid

    def get_agents(self) -> list[Agent]:
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> Agent:
        return self._agents[agent_id]

    def set_agent_position(self, agent_id: str, x: int, y: int) -> None:
        self._agents[agent_id].x = x
        self._agents[agent_id].y = y
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_store.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/persistence/store.py backend/tests/test_store.py
git commit -m "feat: add in-memory Store holding a collection of agents"
```

---

### Task 5: Simulation tick loop

**Files:**
- Modify: `backend/app/world/simulation.py`
- Test: `backend/tests/test_simulation.py`

**Interfaces:**
- Consumes: `Store` from `app.persistence.store` (Task 4), specifically `.get_grid()`, `.get_agents()`, `.get_agent(agent_id)`, `.set_agent_position(agent_id, x, y)`.
- Produces: `Simulation(store: Store)` with `.tick() -> list[Agent]` — advances **every** agent in the store one tile each call, cycling each agent's own direction independently on hitting a grid edge, and returns the full updated agent list. This is the piece that makes "add a second agent" free: `.tick()` already loops over whatever `store.get_agents()` returns.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_simulation.py
from app.world.grid import Grid
from app.world.agent import Agent
from app.persistence.store import Store
from app.world.simulation import Simulation


def test_tick_moves_single_agent_up_first():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    store = Store(grid, [agent])
    sim = Simulation(store)

    result = sim.tick()

    assert len(result) == 1
    assert (result[0].x, result[0].y) == (10, 9)


def test_tick_cycles_direction_at_top_edge():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=0)
    store = Store(grid, [agent])
    sim = Simulation(store)

    result = sim.tick()

    assert (result[0].x, result[0].y) == (11, 0)


def test_tick_advances_every_agent_independently():
    # Proves the multi-agent seam works even though phase 1a ships one agent.
    grid = Grid(width=20, height=20)
    agent1 = Agent(agent_id="a1", x=10, y=10)
    agent2 = Agent(agent_id="a2", x=5, y=5)
    store = Store(grid, [agent1, agent2])
    sim = Simulation(store)

    result = sim.tick()

    positions = {agent.id: (agent.x, agent.y) for agent in result}
    assert positions["a1"] == (10, 9)
    assert positions["a2"] == (5, 4)


def test_tick_returns_agents_from_the_store():
    grid = Grid(width=20, height=20)
    agent = Agent(agent_id="a1", x=10, y=10)
    store = Store(grid, [agent])
    sim = Simulation(store)

    result = sim.tick()

    assert result[0] is store.get_agent("a1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_simulation.py -v`
Expected: FAIL — `Simulation` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/world/simulation.py
from app.persistence.store import Store
from app.world.agent import Agent
from app.world.grid import Grid

# up, right, down, left
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]


class Simulation:
    def __init__(self, store: Store):
        self._store = store
        self._direction_index = {agent.id: 0 for agent in store.get_agents()}

    def tick(self) -> list[Agent]:
        grid = self._store.get_grid()
        return [self._advance(agent, grid) for agent in self._store.get_agents()]

    def _advance(self, agent: Agent, grid: Grid) -> Agent:
        agent_id = agent.id
        for _ in range(len(DIRECTIONS)):
            dx, dy = DIRECTIONS[self._direction_index[agent_id]]
            new_x, new_y = agent.x + dx, agent.y + dy
            if grid.in_bounds(new_x, new_y):
                self._store.set_agent_position(agent_id, new_x, new_y)
                return self._store.get_agent(agent_id)
            self._direction_index[agent_id] = (
                self._direction_index[agent_id] + 1
            ) % len(DIRECTIONS)

        # All four directions blocked (grid smaller than 2x2) — stay put.
        return self._store.get_agent(agent_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_simulation.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/world/simulation.py backend/tests/test_simulation.py
git commit -m "feat: add Simulation tick loop that advances every agent independently"
```

---

### Task 6: WebSocket connection manager

**Files:**
- Modify: `backend/app/api/websocket.py`
- Test: `backend/tests/test_websocket.py`

**Interfaces:**
- Produces: `ConnectionManager` with async `.connect(websocket) -> None`, `.disconnect(websocket) -> None`, async `.broadcast(message: dict) -> None`. Deliberately shape-agnostic — it broadcasts whatever dict it's given, so it needs zero changes whether the payload is one agent or fifty.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_websocket.py
import json
import pytest
from app.api.websocket import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent = []
        self.fail_on_send = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, data: str):
        if self.fail_on_send:
            raise RuntimeError("connection closed")
        self.sent.append(data)


@pytest.mark.asyncio
async def test_connect_accepts_and_registers_websocket():
    manager = ConnectionManager()
    ws = FakeWebSocket()

    await manager.connect(ws)

    assert ws.accepted is True
    assert ws in manager._connections


@pytest.mark.asyncio
async def test_broadcast_sends_agents_list_to_all_connected():
    manager = ConnectionManager()
    ws1, ws2 = FakeWebSocket(), FakeWebSocket()
    await manager.connect(ws1)
    await manager.connect(ws2)

    await manager.broadcast({"agents": [{"id": "a1", "x": 1, "y": 2}]})

    assert json.loads(ws1.sent[0]) == {"agents": [{"id": "a1", "x": 1, "y": 2}]}
    assert json.loads(ws2.sent[0]) == {"agents": [{"id": "a1", "x": 1, "y": 2}]}


@pytest.mark.asyncio
async def test_broadcast_drops_connection_that_fails_to_send():
    manager = ConnectionManager()
    ws1, ws2 = FakeWebSocket(), FakeWebSocket()
    ws1.fail_on_send = True
    await manager.connect(ws1)
    await manager.connect(ws2)

    await manager.broadcast({"agents": []})

    assert ws1 not in manager._connections
    assert ws2 in manager._connections


def test_disconnect_removes_websocket():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager._connections.append(ws)

    manager.disconnect(ws)

    assert ws not in manager._connections
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_websocket.py -v`
Expected: FAIL — `ConnectionManager` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/api/websocket.py
import json


class ConnectionManager:
    def __init__(self):
        self._connections = []

    async def connect(self, websocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        data = json.dumps(message)
        for connection in list(self._connections):
            try:
                await connection.send_text(data)
            except Exception:
                self.disconnect(connection)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_websocket.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/websocket.py backend/tests/test_websocket.py
git commit -m "feat: add WebSocket ConnectionManager with broadcast"
```

---

### Task 7: FastAPI app wiring (main.py)

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `Grid` (Task 2), `Agent` (Task 3), `Store` (Task 4), `Simulation` (Task 5), `ConnectionManager` (Task 6).
- Produces: a running FastAPI `app` with a `/ws` route that sends `{"agents": [...]}` immediately on connect, and a background tick loop that broadcasts `{"agents": [...]}` on the interval from `core/config.py`. **This is where a second agent gets added later** — one more line in the list passed to `Store(...)`.

- [ ] **Step 1: Write config values**

```python
# backend/app/core/config.py
GRID_WIDTH = 20
GRID_HEIGHT = 20
AGENT_START_ID = "villager-1"
AGENT_START_X = 10
AGENT_START_Y = 10
TICK_INTERVAL_SECONDS = 0.5
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_main.py
import json
from fastapi.testclient import TestClient
from app.main import app


def test_websocket_sends_initial_agents_on_connect():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_text()
            payload = json.loads(data)
            assert payload == {"agents": [{"id": "villager-1", "x": 10, "y": 10}]}
```

This relies on the config values from Step 1. It doesn't wait for a real
tick — `Simulation` (Task 5) and `ConnectionManager` (Task 6) already have
their own tests for that behavior; this test only proves the wiring:
connect → receive current agent list immediately.

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_main.py -v`
Expected: FAIL — `app` not defined, or `/ws` route missing.

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/main.py
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.core.config import (
    GRID_WIDTH,
    GRID_HEIGHT,
    AGENT_START_ID,
    AGENT_START_X,
    AGENT_START_Y,
    TICK_INTERVAL_SECONDS,
)
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.simulation import Simulation
from app.persistence.store import Store
from app.api.websocket import ConnectionManager

store = Store(
    Grid(GRID_WIDTH, GRID_HEIGHT),
    [Agent(agent_id=AGENT_START_ID, x=AGENT_START_X, y=AGENT_START_Y)],
)
simulation = Simulation(store)
manager = ConnectionManager()


def _agents_payload(agents) -> dict:
    return {"agents": [agent.to_dict() for agent in agents]}


async def tick_loop():
    while True:
        await asyncio.sleep(TICK_INTERVAL_SECONDS)
        agents = simulation.tick()
        await manager.broadcast(_agents_payload(agents))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(tick_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_text(json.dumps(_agents_payload(store.get_agents())))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_main.py -v`
Expected: PASS (1 test)

- [ ] **Step 6: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: PASS (all tests across every task so far)

- [ ] **Step 7: Manually verify the server runs**

Run: `uvicorn app.main:app --reload --port 8000`
Expected: server starts without errors; visiting `http://localhost:8000/docs` shows the FastAPI docs page.

Leave this running — it's needed for Task 11's end-to-end check.

- [ ] **Step 8: Commit**

```bash
git add backend/app/main.py backend/app/core/config.py backend/tests/test_main.py
git commit -m "feat: wire FastAPI app with tick loop and /ws endpoint"
```

---

### Task 8: Frontend project scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Produces: a running Vite dev server rendering a React app, ready for later tasks to build into.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "madu-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/three": "^0.169.0",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Madu</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Write src/App.tsx (placeholder, replaced in Task 11)**

```tsx
function App() {
  return <div>Madu</div>
}

export default App
```

- [ ] **Step 7: Install dependencies**

Run:
```bash
cd frontend
npm install
```

- [ ] **Step 8: Verify the dev server runs**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`); opening it in a browser shows the text "Madu".

Stop the server (Ctrl+C) before continuing to the next task.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/package-lock.json
git commit -m "chore: scaffold Vite + React + TypeScript frontend"
```

---

### Task 9: WebSocket client hook

**Files:**
- Create: `frontend/src/hooks/parseAgentsMessage.ts`
- Create: `frontend/src/hooks/parseAgentsMessage.test.ts`
- Create: `frontend/src/hooks/useAgentPositions.ts`

**Interfaces:**
- Produces: `AgentPosition` type `{ id: string; x: number; y: number }`; `parseAgentsMessage(raw: string): AgentPosition[]` (throws on malformed input); `useAgentPositions(url: string): AgentPosition[]` React hook (returns `[]` until the first message arrives).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/parseAgentsMessage.test.ts
import { describe, it, expect } from 'vitest'
import { parseAgentsMessage } from './parseAgentsMessage'

describe('parseAgentsMessage', () => {
  it('parses a single-agent message', () => {
    const result = parseAgentsMessage('{"agents": [{"id": "a1", "x": 3, "y": 5}]}')
    expect(result).toEqual([{ id: 'a1', x: 3, y: 5 }])
  })

  it('parses a multi-agent message', () => {
    const raw = '{"agents": [{"id": "a1", "x": 1, "y": 1}, {"id": "a2", "x": 2, "y": 2}]}'
    const result = parseAgentsMessage(raw)
    expect(result).toEqual([
      { id: 'a1', x: 1, y: 1 },
      { id: 'a2', x: 2, y: 2 },
    ])
  })

  it('throws when agents is missing', () => {
    expect(() => parseAgentsMessage('{}')).toThrow()
  })

  it('throws when an agent entry is missing a field', () => {
    expect(() => parseAgentsMessage('{"agents": [{"id": "a1", "x": 1}]}')).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseAgentsMessage('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test`
Expected: FAIL — `parseAgentsMessage.ts` has no exports (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// frontend/src/hooks/parseAgentsMessage.ts
export interface AgentPosition {
  id: string
  x: number
  y: number
}

export function parseAgentsMessage(raw: string): AgentPosition[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.agents)) {
    throw new Error('Invalid agents message: "agents" is not an array')
  }
  return data.agents.map((entry: unknown): AgentPosition => {
    const agent = entry as { id?: unknown; x?: unknown; y?: unknown }
    if (
      typeof agent.id !== 'string' ||
      typeof agent.x !== 'number' ||
      typeof agent.y !== 'number'
    ) {
      throw new Error('Invalid agent entry: missing id, x, or y')
    }
    return { id: agent.id, x: agent.x, y: agent.y }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the WebSocket hook (not unit tested — thin wrapper over the browser WebSocket API, verified manually in Task 11)**

```typescript
// frontend/src/hooks/useAgentPositions.ts
import { useEffect, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'

export function useAgentPositions(url: string): AgentPosition[] {
  const [agents, setAgents] = useState<AgentPosition[]>([])

  useEffect(() => {
    const socket = new WebSocket(url)
    socket.onmessage = (event) => {
      setAgents(parseAgentsMessage(event.data))
    }
    return () => socket.close()
  }, [url])

  return agents
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/parseAgentsMessage.ts frontend/src/hooks/parseAgentsMessage.test.ts frontend/src/hooks/useAgentPositions.ts
git commit -m "feat: add WebSocket client hook for agent positions list"
```

---

### Task 10: Three.js scene

**Files:**
- Create: `frontend/src/scene/AgentScene.tsx`

**Interfaces:**
- Consumes: `AgentPosition` type from `frontend/src/hooks/parseAgentsMessage.ts` (Task 9).
- Produces: `AgentScene` React component, prop `{ agents: AgentPosition[] }`. Renders a flat ground plane plus one low-poly mesh per agent, keyed by `id` — meshes are created/removed automatically to match whatever the `agents` array contains, so a second agent needs zero changes here.

No unit test for this task — per the spec's testing approach, Three.js
rendering code is verified visually, not with automated tests. Verification
is a manual step below.

- [ ] **Step 1: Write the scene component**

```tsx
// frontend/src/scene/AgentScene.tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'

const GRID_SIZE = 20

interface AgentSceneProps {
  agents: AgentPosition[]
}

export function AgentScene({ agents }: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())

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

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}
```

- [ ] **Step 2: Temporarily verify the scene renders with fixed positions**

This is a throwaway manual check, not part of the final app — confirms the
scene itself works, including the multi-agent mesh bookkeeping, before
wiring it to live data in Task 11. Temporarily edit `frontend/src/App.tsx`:

```tsx
import { AgentScene } from './scene/AgentScene'

function App() {
  return (
    <AgentScene
      agents={[
        { id: 'a1', x: 5, y: 5 },
        { id: 'a2', x: 12, y: 8 },
      ]}
    />
  )
}

export default App
```

Run: `npm run dev`, open the browser.
Expected: a dark scene with a flat green ground plane and **two** small
polygon (icosahedron) shapes sitting on it at different tiles, lit from
above. Seeing two prove the per-id mesh bookkeeping works, not just the
single-agent case phase 1a ships with.

- [ ] **Step 3: Revert the temporary App.tsx edit**

```bash
git checkout frontend/src/App.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/scene/AgentScene.tsx
git commit -m "feat: add Three.js AgentScene rendering one mesh per agent id"
```

---

### Task 11: Final wiring — live agent movement end to end

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useAgentPositions` (Task 9), `AgentScene` (Task 10).

- [ ] **Step 1: Wire the hook to the scene**

```tsx
// frontend/src/App.tsx
import { useAgentPositions } from './hooks/useAgentPositions'
import { AgentScene } from './scene/AgentScene'

function App() {
  const agents = useAgentPositions('ws://localhost:8000/ws')
  return <AgentScene agents={agents} />
}

export default App
```

- [ ] **Step 2: Run the full frontend test suite**

Run (from `frontend/`): `npm run test`
Expected: PASS (all tests from Task 9)

- [ ] **Step 3: End-to-end manual verification**

Terminal 1 (from `backend/`, with `.venv` activated):
```bash
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (from `frontend/`):
```bash
npm run dev
```

Open the printed frontend URL in a browser.

Expected: the scene loads showing the ground plane and one agent shape.
Every ~500ms, the shape visibly steps one tile in a direction, cycling
direction when it reaches a grid edge — with zero manual refresh. This is
phase 1a's definition of done from the spec.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/App.tsx
git commit -m "feat: wire live agent positions into Three.js scene end to end"
```

---

## Adding a second agent later (not part of this plan — for reference)

Once phase 1a is done, adding another agent is: add one more `Agent(...)`
entry to the list passed into `Store(...)` in `backend/app/main.py`, e.g.

```python
[
    Agent(agent_id="villager-1", x=AGENT_START_X, y=AGENT_START_Y),
    Agent(agent_id="villager-2", x=3, y=3),
]
```

`Simulation`, `ConnectionManager`, `useAgentPositions`, and `AgentScene`
all already operate on the full collection — none of them need to change.

## Self-Review Notes

- **Spec coverage:** Architecture (backend owns state / frontend renders / WebSocket push) → Tasks 1-11 collectively. Data model (Grid, Agent, discrete 4-directional movement) → Tasks 2, 3, 5. Backend behavior (tick loop, edge-cycling, broadcast) → Tasks 5, 6, 7. Frontend behavior (flat plane, perspective camera, low-poly shape, WebSocket connect, position updates move the shape) → Tasks 8, 9, 10, 11. Testing approach (manual/visual for rendering, unit tests for branching logic) → reflected in every task's test step. Definition of done → Task 11 Step 3. Backend file structure → File Structure section matches the spec, plus `test_agent.py`, `test_store.py`, `test_websocket.py`, `test_main.py`, `requirements.txt`/`pytest.ini` as necessary infrastructure the spec didn't itemize file-by-file. Multi-agent-ready infra (this session's refactor request) → `Agent.id`, `Store`/`Simulation` operating on `list[Agent]`, `{"agents": [...]}` payload shape, and `AgentScene`'s per-id mesh map — verified by `test_tick_advances_every_agent_independently` and Task 10's two-agent manual check, even though only one agent ships.
- **Placeholder scan:** no TBD/TODO; every step has real code or a real command.
- **Type consistency:** `Agent.to_dict()` returns `{"id", "x", "y"}` consistently used in `main.py`'s `_agents_payload`. `Store.get_agent(agent_id: str)` / `.set_agent_position(agent_id, x, y)` signatures match between Task 4's definition and Task 5's `Simulation` usage. `Simulation.tick() -> list[Agent]` matches Task 7's `for a in agents` usage. `AgentPosition { id, x, y }` from Task 9 is imported and used as-is in Task 10 and Task 11 without redefinition. `parseAgentsMessage` / `useAgentPositions` naming (plural) used consistently across Tasks 9, 10, 11 — no leftover singular `parseAgentMessage`/`useAgentPosition` references from the pre-refactor version of this plan.
