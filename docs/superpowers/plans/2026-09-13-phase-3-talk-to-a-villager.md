# Phase 3: Talk to a Villager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each villager a name, role, and one line of dialogue, and let the player walk up to one and press E to see it in a speech bubble above their head.

**Architecture:** Villager identity (name/role/line) is static data sent once in the initial WebSocket payload, exactly like buildings already are — never repeated in the periodic position broadcast. Proximity detection and the key-press trigger are pure frontend concerns (the backend has no notion of "nearby"), matching how camera pan/zoom is already frontend-only.

**Tech Stack:** Python/FastAPI backend (pytest), React/Three.js frontend (vitest).

**Spec:** `docs/superpowers/specs/2026-09-13-phase-3-talk-to-a-villager-design.md`

## Global Constraints

- Talk range is `3` tiles (`TALK_RANGE_TILES` backend constant, sent to the frontend — never hardcoded a second time there).
- Each villager has exactly one fixed line — no rotation, no branching.
- Identity fields (`name`, `role`, `line`) ride in the initial payload only; the periodic broadcast stays position-only (`id`, `x`, `y`).
- Speech bubble auto-dismisses after 4 seconds, or immediately on leaving range — whichever comes first.
- Only the single closest in-range villager is ever prompted or talked to.

---

## Task 1: Backend — Agent gains name, role, and line

**Files:**
- Modify: `backend/app/world/agent.py`
- Test: `backend/tests/test_agent.py`

**Interfaces:**
- Produces: `Agent(agent_id: str, x: int, y: int, name: str = "", role: str = "", line: str = "")` with new attributes `.name: str`, `.role: str`, `.line: str`; `to_dict()` now returns `{"id", "x", "y", "name", "role", "line"}`.
- Defaults are `""` (not required) so the ~13 existing `Agent(...)` call sites in `test_store.py` and `test_simulation.py` — which only exercise position/store logic and don't check `to_dict()` — keep working unmodified.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `backend/tests/test_agent.py`:

```python
from app.world.agent import Agent
from app.world.entity import Entity


def test_agent_stores_id_position_and_identity():
    agent = Agent(
        agent_id="villager-1",
        x=3,
        y=7,
        name="Mira",
        role="Fisherwoman",
        line="The tide's been good to us this week.",
    )
    assert agent.id == "villager-1"
    assert agent.x == 3
    assert agent.y == 7
    assert agent.name == "Mira"
    assert agent.role == "Fisherwoman"
    assert agent.line == "The tide's been good to us this week."


def test_agent_to_dict():
    agent = Agent(
        agent_id="villager-1",
        x=3,
        y=7,
        name="Mira",
        role="Fisherwoman",
        line="The tide's been good to us this week.",
    )
    assert agent.to_dict() == {
        "id": "villager-1",
        "x": 3,
        "y": 7,
        "name": "Mira",
        "role": "Fisherwoman",
        "line": "The tide's been good to us this week.",
    }


def test_agent_identity_defaults_to_empty_strings():
    agent = Agent(agent_id="villager-1", x=3, y=7)
    assert agent.name == ""
    assert agent.role == ""
    assert agent.line == ""


def test_agent_is_an_entity():
    agent = Agent(
        agent_id="villager-1", x=3, y=7, name="Mira", role="Fisherwoman", line="Hi."
    )
    assert isinstance(agent, Entity)


def test_agent_default_footprint_is_one_tile():
    agent = Agent(
        agent_id="villager-1", x=3, y=7, name="Mira", role="Fisherwoman", line="Hi."
    )
    assert agent.width == 1
    assert agent.height == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/test_agent.py -v`
Expected: FAIL — `TypeError` (unexpected keyword arguments `name`, `role`, `line`) or `AttributeError`.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `backend/app/world/agent.py`:

```python
from app.world.entity import Entity


class Agent(Entity):
    def __init__(
        self,
        agent_id: str,
        x: int,
        y: int,
        name: str = "",
        role: str = "",
        line: str = "",
    ):
        super().__init__(entity_id=agent_id, x=x, y=y)
        self.name = name
        self.role = role
        self.line = line

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "name": self.name,
            "role": self.role,
            "line": self.line,
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/test_agent.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full backend suite to confirm nothing else broke**

Run: `cd backend && .venv/bin/pytest -v`
Expected: PASS — `test_store.py` and `test_simulation.py` still construct `Agent(...)` without identity args, which is why Step 3's defaults matter. `test_main.py` is expected to now FAIL (it asserts an exact `to_dict()`-shaped payload) — that's fixed in Task 2, not here.

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/world/agent.py tests/test_agent.py
git commit -m "$(cat <<'EOF'
feat: give Agent a name, role, and line of dialogue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend — villager identities, talk range, and payload split

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `Agent(agent_id, x, y, name, role, line)` from Task 1.
- Produces: `_state_payload(agents, player) -> dict` now builds **position-only** agent dicts (`{"id", "x", "y"}`) directly, instead of calling `agent.to_dict()` — this is what keeps identity out of the periodic broadcast. `_initial_payload(agents, player, buildings, talk_range_tiles) -> dict` gains a fourth parameter and uses `agent.to_dict()` (the full 6-field form) plus a new top-level `"talk_range_tiles"` key.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `backend/tests/test_main.py`:

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
                    {
                        "id": "villager-1",
                        "x": 10,
                        "y": 10,
                        "name": "Mira",
                        "role": "Fisherwoman",
                        "line": "The tide's been good to us this week.",
                    },
                    {
                        "id": "villager-2",
                        "x": 25,
                        "y": 10,
                        "name": "Tomas",
                        "role": "Baker",
                        "line": "Fresh bread every morning — come by before it's gone.",
                    },
                    {
                        "id": "villager-3",
                        "x": 17,
                        "y": 25,
                        "name": "Elena",
                        "role": "Merchant",
                        "line": "Business is slow, but the view of the harbor makes up for it.",
                    },
                ],
                "player": {"id": "player-1", "x": 5, "y": 5},
                "buildings": [
                    {"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5},
                    {"id": "building-2", "x": 35, "y": 35, "width": 5, "height": 5},
                ],
                "talk_range_tiles": 3,
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
            assert "talk_range_tiles" not in payload
            assert payload["agents"][0] == {"id": "villager-1", "x": 10, "y": 10}


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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_main.py -v`
Expected: FAIL — initial payload is missing `name`/`role`/`line`/`talk_range_tiles`.

- [ ] **Step 3: Add the new config constants**

Add to the end of `backend/app/core/config.py`:

```python
AGENT_1_NAME = "Mira"
AGENT_1_ROLE = "Fisherwoman"
AGENT_1_LINE = "The tide's been good to us this week."
AGENT_2_NAME = "Tomas"
AGENT_2_ROLE = "Baker"
AGENT_2_LINE = "Fresh bread every morning — come by before it's gone."
AGENT_3_NAME = "Elena"
AGENT_3_ROLE = "Merchant"
AGENT_3_LINE = "Business is slow, but the view of the harbor makes up for it."
TALK_RANGE_TILES = 3
```

- [ ] **Step 4: Update `backend/app/main.py`**

In the import block from `app.core.config`, add the nine new name/role/line constants and `TALK_RANGE_TILES` to the existing import list (alongside `AGENT_START_ID`, `AGENT_2_START_ID`, etc.).

Replace the three `Agent(...)` construction calls:

```python
            Agent(
                agent_id=AGENT_START_ID,
                x=AGENT_START_X,
                y=AGENT_START_Y,
                name=AGENT_1_NAME,
                role=AGENT_1_ROLE,
                line=AGENT_1_LINE,
            ),
            Agent(
                agent_id=AGENT_2_START_ID,
                x=AGENT_2_START_X,
                y=AGENT_2_START_Y,
                name=AGENT_2_NAME,
                role=AGENT_2_ROLE,
                line=AGENT_2_LINE,
            ),
            Agent(
                agent_id=AGENT_3_START_ID,
                x=AGENT_3_START_X,
                y=AGENT_3_START_Y,
                name=AGENT_3_NAME,
                role=AGENT_3_ROLE,
                line=AGENT_3_LINE,
            ),
```

Replace `_state_payload` and `_initial_payload`:

```python
def _state_payload(agents, player) -> dict:
    return {
        "agents": [
            {"id": agent.id, "x": agent.x, "y": agent.y} for agent in agents
        ],
        "player": player.to_dict(),
    }


def _initial_payload(agents, player, buildings, talk_range_tiles) -> dict:
    return {
        "agents": [agent.to_dict() for agent in agents],
        "player": player.to_dict(),
        "buildings": [building.to_dict() for building in buildings],
        "talk_range_tiles": talk_range_tiles,
    }
```

Update the one call site of `_initial_payload` (inside `websocket_endpoint`):

```python
            await websocket.send_text(
                json.dumps(
                    _initial_payload(
                        store.get_agents(),
                        store.get_player(),
                        store.get_buildings(),
                        TALK_RANGE_TILES,
                    )
                )
            )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest -v`
Expected: PASS (full suite, including `test_agent.py` from Task 1)

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/core/config.py app/main.py tests/test_main.py
git commit -m "$(cat <<'EOF'
feat: give villagers real identities and send talk range to the frontend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — parse villager identities and talk range

**Files:**
- Create: `frontend/src/hooks/parseVillagerIdentities.ts`
- Test: `frontend/src/hooks/parseVillagerIdentities.test.ts`
- Create: `frontend/src/hooks/parseTalkRange.ts`
- Test: `frontend/src/hooks/parseTalkRange.test.ts`
- Create: `frontend/src/hooks/mergeVillagerData.ts`
- Test: `frontend/src/hooks/mergeVillagerData.test.ts`
- Modify: `frontend/src/hooks/useGameConnection.ts`

**Interfaces:**
- Consumes: `AgentPosition { id: string; x: number; y: number }` (existing, from `parseAgentsMessage.ts`).
- Produces: `VillagerIdentity { id: string; name: string; role: string; line: string }`, `parseVillagerIdentities(raw: string): VillagerIdentity[]`, `parseTalkRange(raw: string): number`, `Villager extends VillagerIdentity { x: number; y: number }`, `mergeVillagerData(agents: AgentPosition[], identities: Map<string, VillagerIdentity>): Villager[]`. `GameConnection.agents` changes type from `AgentPosition[]` to `Villager[]`; `GameConnection` gains `talkRangeTiles: number`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/parseVillagerIdentities.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseVillagerIdentities } from './parseVillagerIdentities'

describe('parseVillagerIdentities', () => {
  it('parses a single villager identity', () => {
    const raw =
      '{"agents": [{"id": "v1", "x": 1, "y": 1, "name": "Mira", "role": "Fisherwoman", "line": "Hello."}]}'
    expect(parseVillagerIdentities(raw)).toEqual([
      { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
    ])
  })

  it('parses multiple villager identities', () => {
    const raw =
      '{"agents": [' +
      '{"id": "v1", "x": 1, "y": 1, "name": "Mira", "role": "Fisherwoman", "line": "Hello."},' +
      '{"id": "v2", "x": 2, "y": 2, "name": "Tomas", "role": "Baker", "line": "Hi there."}' +
      ']}'
    expect(parseVillagerIdentities(raw)).toEqual([
      { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
      { id: 'v2', name: 'Tomas', role: 'Baker', line: 'Hi there.' },
    ])
  })

  it('throws when agents is missing', () => {
    expect(() => parseVillagerIdentities('{}')).toThrow()
  })

  it('throws when an agent entry is missing name, role, or line', () => {
    expect(() =>
      parseVillagerIdentities('{"agents": [{"id": "v1", "x": 1, "y": 1}]}'),
    ).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseVillagerIdentities('not json')).toThrow()
  })
})
```

Create `frontend/src/hooks/parseTalkRange.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseTalkRange } from './parseTalkRange'

describe('parseTalkRange', () => {
  it('parses the talk range', () => {
    expect(parseTalkRange('{"talk_range_tiles": 3}')).toBe(3)
  })

  it('throws when talk_range_tiles is missing', () => {
    expect(() => parseTalkRange('{}')).toThrow()
  })

  it('throws when talk_range_tiles is not a number', () => {
    expect(() => parseTalkRange('{"talk_range_tiles": "three"}')).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseTalkRange('not json')).toThrow()
  })
})
```

Create `frontend/src/hooks/mergeVillagerData.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeVillagerData } from './mergeVillagerData'

describe('mergeVillagerData', () => {
  it('merges position and identity by id', () => {
    const agents = [{ id: 'v1', x: 3, y: 4 }]
    const identities = new Map([
      ['v1', { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' }],
    ])
    expect(mergeVillagerData(agents, identities)).toEqual([
      { id: 'v1', x: 3, y: 4, name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
    ])
  })

  it('skips an agent with no matching identity yet', () => {
    const agents = [{ id: 'v1', x: 3, y: 4 }]
    expect(mergeVillagerData(agents, new Map())).toEqual([])
  })

  it('returns an empty array when there are no agents', () => {
    expect(mergeVillagerData([], new Map())).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- --run parseVillagerIdentities parseTalkRange mergeVillagerData`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write the implementations**

Create `frontend/src/hooks/parseVillagerIdentities.ts`:

```ts
export interface VillagerIdentity {
  id: string
  name: string
  role: string
  line: string
}

export function parseVillagerIdentities(raw: string): VillagerIdentity[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.agents)) {
    throw new Error('Invalid agents message: "agents" is not an array')
  }
  return data.agents.map((entry: unknown): VillagerIdentity => {
    const agent = entry as {
      id?: unknown
      name?: unknown
      role?: unknown
      line?: unknown
    }
    if (
      typeof agent.id !== 'string' ||
      typeof agent.name !== 'string' ||
      typeof agent.role !== 'string' ||
      typeof agent.line !== 'string'
    ) {
      throw new Error('Invalid agent entry: missing id, name, role, or line')
    }
    return { id: agent.id, name: agent.name, role: agent.role, line: agent.line }
  })
}
```

Create `frontend/src/hooks/parseTalkRange.ts`:

```ts
export function parseTalkRange(raw: string): number {
  const data = JSON.parse(raw)
  if (typeof data.talk_range_tiles !== 'number') {
    throw new Error('Invalid message: "talk_range_tiles" is not a number')
  }
  return data.talk_range_tiles
}
```

Create `frontend/src/hooks/mergeVillagerData.ts`:

```ts
import { AgentPosition } from './parseAgentsMessage'
import { VillagerIdentity } from './parseVillagerIdentities'

export interface Villager extends VillagerIdentity {
  x: number
  y: number
}

export function mergeVillagerData(
  agents: AgentPosition[],
  identities: Map<string, VillagerIdentity>,
): Villager[] {
  const result: Villager[] = []
  for (const agent of agents) {
    const identity = identities.get(agent.id)
    if (identity) {
      result.push({ ...identity, x: agent.x, y: agent.y })
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- --run parseVillagerIdentities parseTalkRange mergeVillagerData`
Expected: PASS (12 tests total across the three files)

- [ ] **Step 5: Wire the new parsers into `useGameConnection.ts`**

Replace the full contents of `frontend/src/hooks/useGameConnection.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'
import { parsePlayerPosition } from './parsePlayerPosition'
import { parseBuildingsMessage, BuildingFootprint } from './parseBuildingsMessage'
import { parseVillagerIdentities, VillagerIdentity } from './parseVillagerIdentities'
import { parseTalkRange } from './parseTalkRange'
import { mergeVillagerData, Villager } from './mergeVillagerData'

export interface GameConnection {
  agents: Villager[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  talkRangeTiles: number
  sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useGameConnection(url: string): GameConnection {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())
  const [player, setPlayer] = useState<AgentPosition | null>(null)
  const [buildings, setBuildings] = useState<BuildingFootprint[]>([])
  const [villagerIdentities, setVillagerIdentities] = useState<
    Map<string, VillagerIdentity>
  >(new Map())
  const [talkRangeTiles, setTalkRangeTiles] = useState<number>(0)
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
        setVillagerIdentities(
          new Map(
            parseVillagerIdentities(event.data).map((identity) => [
              identity.id,
              identity,
            ]),
          ),
        )
        setTalkRangeTiles(parseTalkRange(event.data))
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

  return {
    agents: mergeVillagerData(Array.from(agents.values()), villagerIdentities),
    player,
    buildings,
    talkRangeTiles,
    sendMove,
  }
}
```

- [ ] **Step 6: Run the full frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: PASS — existing tests for `parseAgentsMessage`, `mergeAgents`, `parseBuildingsMessage`, `parsePlayerPosition` are untouched and still pass; `useGameConnection.ts` has no test file (matches the existing pattern — hooks with side effects aren't unit tested in this codebase), so it's verified in Task 5's manual browser check.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/hooks/parseVillagerIdentities.ts src/hooks/parseVillagerIdentities.test.ts \
  src/hooks/parseTalkRange.ts src/hooks/parseTalkRange.test.ts \
  src/hooks/mergeVillagerData.ts src/hooks/mergeVillagerData.test.ts \
  src/hooks/useGameConnection.ts
git commit -m "$(cat <<'EOF'
feat: parse villager identities and talk range from the backend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — find the closest in-range villager

**Files:**
- Create: `frontend/src/hooks/findNearbyVillager.ts`
- Test: `frontend/src/hooks/findNearbyVillager.test.ts`

**Interfaces:**
- Consumes: `Villager` from `mergeVillagerData.ts` (Task 3).
- Produces: `findNearbyVillager(player: {x: number; y: number} | null, villagers: Villager[], rangeTiles: number): Villager | null`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/findNearbyVillager.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findNearbyVillager } from './findNearbyVillager'
import { Villager } from './mergeVillagerData'

function villager(id: string, x: number, y: number): Villager {
  return { id, x, y, name: id, role: 'Villager', line: 'Hi.' }
}

describe('findNearbyVillager', () => {
  it('returns null when there is no player', () => {
    expect(findNearbyVillager(null, [villager('v1', 0, 0)], 3)).toBeNull()
  })

  it('returns null when nothing is in range', () => {
    const player = { x: 0, y: 0 }
    expect(findNearbyVillager(player, [villager('v1', 10, 10)], 3)).toBeNull()
  })

  it('returns the villager when exactly one is in range', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 1, 1)
    expect(findNearbyVillager(player, [v1], 3)).toEqual(v1)
  })

  it('returns the closest villager when multiple are in range', () => {
    const player = { x: 0, y: 0 }
    const near = villager('near', 1, 0)
    const far = villager('far', 2, 0)
    expect(findNearbyVillager(player, [far, near], 3)).toEqual(near)
  })

  it('includes a villager exactly at the range boundary', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 3, 0)
    expect(findNearbyVillager(player, [v1], 3)).toEqual(v1)
  })

  it('excludes a villager just past the range boundary', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 3.01, 0)
    expect(findNearbyVillager(player, [v1], 3)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run findNearbyVillager`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/hooks/findNearbyVillager.ts`:

```ts
import { Villager } from './mergeVillagerData'

export function findNearbyVillager(
  player: { x: number; y: number } | null,
  villagers: Villager[],
  rangeTiles: number,
): Villager | null {
  if (!player) return null

  let closest: Villager | null = null
  let closestDistance = Infinity

  for (const villager of villagers) {
    const dx = villager.x - player.x
    const dy = villager.y - player.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= rangeTiles && distance < closestDistance) {
      closest = villager
      closestDistance = distance
    }
  }

  return closest
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run findNearbyVillager`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/hooks/findNearbyVillager.ts src/hooks/findNearbyVillager.test.ts
git commit -m "$(cat <<'EOF'
feat: find the closest in-range villager

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — talk key, dialogue state, and speech bubble UI

**Files:**
- Create: `frontend/src/hooks/useTalkTrigger.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/scene/AgentScene.tsx`

**Interfaces:**
- Consumes: `findNearbyVillager` (Task 4), `GameConnection.agents: Villager[]` and `.talkRangeTiles` (Task 3), `Villager` type (Task 3).
- Produces: `useTalkTrigger(onTalk: () => void): void`. `AgentScene` gains two new props: `nearbyVillager: Villager | null`, `talkingVillager: Villager | null`; its existing `agents` prop type changes from `AgentPosition[]` to `Villager[]`.

No new test file for this task — matches the existing pattern where hooks with side effects (`useKeyboardMovement`, `useGameConnection`) and the Three.js scene itself have no automated tests. Verified manually per the Definition of Done below.

- [ ] **Step 1: Create the talk-key hook**

Create `frontend/src/hooks/useTalkTrigger.ts`:

```ts
import { useEffect } from 'react'

export function useTalkTrigger(onTalk: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'e' || event.key === 'E') {
        onTalk()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTalk])
}
```

- [ ] **Step 2: Wire dialogue state into `App.tsx`**

Replace the full contents of `frontend/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { useTalkTrigger } from './hooks/useTalkTrigger'
import { findNearbyVillager } from './hooks/findNearbyVillager'
import { AgentScene } from './scene/AgentScene'

const TALK_DISMISS_MS = 4000

function App() {
  const { agents, player, buildings, talkRangeTiles, sendMove } =
    useGameConnection('ws://localhost:8420/ws')
  useKeyboardMovement(sendMove)

  const [talkingVillagerId, setTalkingVillagerId] = useState<string | null>(null)
  const nearbyVillager = findNearbyVillager(player, agents, talkRangeTiles)

  useTalkTrigger(() => {
    if (nearbyVillager) {
      setTalkingVillagerId(nearbyVillager.id)
    }
  })

  // Auto-dismiss after TALK_DISMISS_MS.
  useEffect(() => {
    if (!talkingVillagerId) return
    const timer = setTimeout(() => setTalkingVillagerId(null), TALK_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [talkingVillagerId])

  // Dismiss immediately on walking out of range.
  useEffect(() => {
    if (talkingVillagerId && nearbyVillager?.id !== talkingVillagerId) {
      setTalkingVillagerId(null)
    }
  }, [talkingVillagerId, nearbyVillager])

  const talkingVillager =
    agents.find((villager) => villager.id === talkingVillagerId) ?? null

  return (
    <AgentScene
      agents={agents}
      player={player}
      buildings={buildings}
      nearbyVillager={talkingVillager ? null : nearbyVillager}
      talkingVillager={talkingVillager}
    />
  )
}

export default App
```

`nearbyVillager={talkingVillager ? null : nearbyVillager}` hides the "Press E" prompt while a bubble is already showing, so the two overlays never appear at once.

- [ ] **Step 3: Add speech bubble overlays to `AgentScene.tsx`**

Replace the full contents of `frontend/src/scene/AgentScene.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'
import { BuildingFootprint } from '../hooks/parseBuildingsMessage'
import { Villager } from '../hooks/mergeVillagerData'

const GRID_SIZE = 50

interface AgentSceneProps {
  agents: Villager[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  nearbyVillager: Villager | null
  talkingVillager: Villager | null
}

export function AgentScene({
  agents,
  player,
  buildings,
  nearbyVillager,
  talkingVillager,
}: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)
  const buildingMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const promptRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nearbyVillagerRef = useRef<Villager | null>(null)
  const talkingVillagerRef = useRef<Villager | null>(null)

  useEffect(() => {
    nearbyVillagerRef.current = nearbyVillager
  }, [nearbyVillager])

  useEffect(() => {
    talkingVillagerRef.current = talkingVillager
  }, [talkingVillager])

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

    const cameraTarget = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2)
    const cameraDirection = new THREE.Vector3(0, GRID_SIZE * 0.8, GRID_SIZE * 0.8).normalize()
    const MIN_ZOOM_DISTANCE = GRID_SIZE * 0.15
    const MAX_ZOOM_DISTANCE = GRID_SIZE * 1.8
    let cameraDistance = GRID_SIZE * 0.5

    // How far past the town's edge you're allowed to drag the view.
    const PAN_MARGIN = GRID_SIZE * 0.3
    const PAN_MIN = -PAN_MARGIN
    const PAN_MAX = GRID_SIZE + PAN_MARGIN

    const updateCameraPosition = () => {
      camera.position.copy(cameraTarget).addScaledVector(cameraDirection, cameraDistance)
      camera.lookAt(cameraTarget)
    }
    updateCameraPosition()

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      cameraDistance = THREE.MathUtils.clamp(
        cameraDistance + event.deltaY * 0.05,
        MIN_ZOOM_DISTANCE,
        MAX_ZOOM_DISTANCE,
      )
      updateCameraPosition()
    }
    mount.addEventListener('wheel', handleWheel, { passive: false })
    mount.style.cursor = 'grab'

    // Drag (mouse or touch) slides the camera across the ground at the same fixed angle.
    const groundForward = new THREE.Vector3(
      cameraTarget.x - camera.position.x,
      0,
      cameraTarget.z - camera.position.z,
    ).normalize()
    const groundRight = groundForward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()

    let isDragging = false
    let lastPointerX = 0
    let lastPointerY = 0

    const handlePointerDown = (event: PointerEvent) => {
      isDragging = true
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      mount.setPointerCapture(event.pointerId)
      mount.style.cursor = 'grabbing'
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastPointerX
      const deltaY = event.clientY - lastPointerY
      lastPointerX = event.clientX
      lastPointerY = event.clientY

      const panScale = (cameraDistance / mount.clientHeight) * 1.2
      cameraTarget.addScaledVector(groundRight, -deltaX * panScale)
      cameraTarget.addScaledVector(groundForward, deltaY * panScale)
      cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, PAN_MIN, PAN_MAX)
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, PAN_MIN, PAN_MAX)
      updateCameraPosition()
    }

    const handlePointerUp = (event: PointerEvent) => {
      isDragging = false
      mount.releasePointerCapture(event.pointerId)
      mount.style.cursor = 'grab'
    }

    mount.addEventListener('pointerdown', handlePointerDown)
    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerup', handlePointerUp)
    mount.addEventListener('pointercancel', handlePointerUp)

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

    // Projects a ground-plane (x, y) tile position to on-screen pixel coordinates,
    // for positioning the HTML prompt/bubble overlays above a villager's head.
    const projectToScreen = (x: number, y: number) => {
      const vector = new THREE.Vector3(x + 0.5, 1.2, y + 0.5)
      vector.project(camera)
      return {
        left: ((vector.x + 1) / 2) * mount.clientWidth,
        top: ((1 - vector.y) / 2) * mount.clientHeight,
      }
    }

    let frameId: number
    const animate = () => {
      renderer.render(scene, camera)

      const promptEl = promptRef.current
      const nearby = nearbyVillagerRef.current
      if (promptEl) {
        if (nearby) {
          const { left, top } = projectToScreen(nearby.x, nearby.y)
          promptEl.style.left = `${left}px`
          promptEl.style.top = `${top}px`
          promptEl.style.display = 'block'
        } else {
          promptEl.style.display = 'none'
        }
      }

      const bubbleEl = bubbleRef.current
      const talking = talkingVillagerRef.current
      if (bubbleEl) {
        if (talking) {
          const { left, top } = projectToScreen(talking.x, talking.y)
          bubbleEl.style.left = `${left}px`
          bubbleEl.style.top = `${top}px`
          bubbleEl.style.display = 'block'
          bubbleEl.textContent = `${talking.name}: ${talking.line}`
        } else {
          bubbleEl.style.display = 'none'
        }
      }

      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      mount.removeEventListener('wheel', handleWheel)
      mount.removeEventListener('pointerdown', handlePointerDown)
      mount.removeEventListener('pointermove', handlePointerMove)
      mount.removeEventListener('pointerup', handlePointerUp)
      mount.removeEventListener('pointercancel', handlePointerUp)
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

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div
        ref={promptRef}
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -100%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'sans-serif',
          display: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Press E
      </div>
      <div
        ref={bubbleRef}
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -100%)',
          background: 'white',
          color: '#1a1a2e',
          padding: '6px 10px',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: 'sans-serif',
          maxWidth: '220px',
          display: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the frontend build and full test suite**

Run: `cd frontend && npm test -- --run && npx tsc -b`
Expected: PASS — all existing tests still pass, and `tsc` reports no type errors (confirms `AgentScene`'s new prop types line up with what `App.tsx` passes).

- [ ] **Step 5: Manual verification in the browser**

With both servers running (`cd backend && .venv/bin/uvicorn app.main:app --reload --port 8420` and `cd frontend && npm run dev`):

1. Walk the player near Mira, Tomas, and Elena in turn. Confirm a "Press E" label appears above each one's head once within range, and disappears when you back away.
2. Press E while in range of each villager. Confirm the correct name and line appear in a white bubble above their head, and the "Press E" prompt disappears while the bubble is showing.
3. Wait ~4 seconds without moving. Confirm the bubble disappears on its own.
4. Talk to a villager, then immediately walk away before 4 seconds pass. Confirm the bubble disappears immediately, not after the full timer.
5. Stand where two villagers are both within 3 tiles (if the current layout allows it) and confirm only the closest one's prompt/bubble ever shows.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/hooks/useTalkTrigger.ts src/App.tsx src/scene/AgentScene.tsx
git commit -m "$(cat <<'EOF'
feat: let the player talk to a nearby villager

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Definition of Done (from the spec)

- [ ] Each of the three villagers has a distinct name, role, and line, visible in the frontend's data.
- [ ] Walking within 3 tiles of a villager shows a "Press E" prompt above them.
- [ ] Pressing E while in range opens a speech bubble with that villager's name and line.
- [ ] The bubble disappears on its own after ~4 seconds, or immediately if the player walks out of range first.
- [ ] Only the single closest villager is ever prompted/talked to at a time, even if two are simultaneously in range.
