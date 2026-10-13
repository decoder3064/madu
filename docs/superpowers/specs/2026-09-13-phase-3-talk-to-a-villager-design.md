# Phase 3: Talk to a Villager

Status: approved
Related: `VISION.md`, `IDEAS.md`, phase 2 spec
(`docs/superpowers/specs/2026-08-24-phase-2-city-expansion-design.md`)

## What this phase is

Phase 2 gave the town buildings and three auto-walking villagers, but a
villager is still just a moving box with no identity — nothing to talk to.
This phase gives each villager a name, a role, and one line of dialogue, and
lets the player walk up to a villager and press a key to hear it in a speech
bubble above their head. This is the first piece of VISION.md's actual core
pillar (agents with identity that the player can interact with) — everything
built so far has been movement and rendering only.

## Explicitly out of scope for this phase

- **Real memory or relationships.** A villager always says the same one
  line, every time, no matter what's happened. Memory-driven dialogue is a
  later phase — this phase only builds the pipe that content will one day
  flow through.
- **ML/LLM-generated dialogue.** `line` is a hand-written string in this
  phase. The data shape (a villager entity with an associated line of text
  sent to the frontend) is deliberately generic enough that a future phase
  could replace "hardcoded string" with "generated string" without changing
  anything else in this design — but that swap is not part of this phase.
- **Player choices / branching conversation.** Talking to a villager shows
  one line and ends. No dialogue trees, no responses.
- **Talking to the player-controlled character or between villagers.** Only
  player-initiates-with-villager is in scope.
- **Rotating/multiple lines per villager.** Each villager has exactly one
  line for now (see Key decisions).

## Architecture

Villager identity (`name`, `role`, `line`) is static for a villager's entire
lifetime, exactly like a building's position and size from phase 2. It
follows the same precedent: sent once, in the initial connect payload, never
repeated in the periodic position broadcast. The frontend merges this
one-time identity data with the ever-changing position data it already
receives, keyed by villager id.

Proximity detection (who's close enough to talk to) and the key-press
trigger are pure frontend/view concerns, the same way camera pan/zoom
already is — the backend has no notion of "nearby" and doesn't need one for
this phase. This keeps the backend focused on simulation truth (where things
are) and the frontend focused on presentation (what the player can do about
it).

## Data model

- **`Agent` gains three fields**: `name: str`, `role: str`, `line: str`.
  `to_dict()` includes them.
- **The three existing villagers get real identities**, replacing the
  `villager-1`/`villager-2`/`villager-3` placeholder ids' only meaning:
  - `villager-1`: name `"Mira"`, role `"Fisherwoman"`, line
    `"The tide's been good to us this week."`
  - `villager-2`: name `"Tomas"`, role `"Baker"`, line
    `"Fresh bread every morning — come by before it's gone."`
  - `villager-3`: name `"Elena"`, role `"Merchant"`, line
    `"Business is slow, but the view of the harbor makes up for it."`
- **New config constants** (`backend/app/core/config.py`), alongside the
  existing per-villager start position constants:
  ```
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
- **Outgoing initial payload** (sent once, on connect — extends the existing
  agents array with the three new fields, and adds one new top-level field
  for the talk range; buildings unaffected):
  ```json
  {
    "agents": [
      {"id": "villager-1", "x": 5, "y": 5, "name": "Mira", "role": "Fisherwoman", "line": "The tide's been good to us this week."},
      ...
    ],
    "player": {...},
    "buildings": [...],
    "talk_range_tiles": 3
  }
  ```
- **Outgoing periodic broadcast** (unchanged shape — position only, no
  identity fields, matching the buildings precedent of not repeating static
  data):
  ```json
  {"agents": [{"id": "villager-1", "x": 5, "y": 6}, ...], "player": {...}}
  ```
- **`TALK_RANGE_TILES = 3`**: how close (in grid tiles) the player must be to
  a villager before talking is possible. Sent once in the initial payload,
  same as buildings and villager identity — the frontend has no local copy
  of this number, so there's exactly one source of truth (see Key
  decisions).

## Backend behavior

1. `Agent.__init__` accepts and stores `name`, `role`, `line`; `to_dict()`
   includes all three alongside the existing `id`, `x`, `y`.
2. The three `Agent(...)` construction calls in `main.py` pass the new
   config constants for name/role/line.
3. No other backend behavior changes — movement, hitboxes, and the walk/rest
   cycle are untouched.

## Frontend behavior

1. `parseAgentsMessage` (or a sibling parser) extracts `name`/`role`/`line`
   from the initial connect message's agent entries, same pattern as
   `parseBuildingsMessage`. This identity data is stored once and never
   overwritten by later position-only broadcasts — mirrors how buildings are
   already handled. `talk_range_tiles` is parsed from the same initial
   message and stored once, the same way.
2. A new pure function, `findNearbyVillager(player, agents, rangeTiles)`,
   returns the closest agent within range or `null` — unit-testable in
   isolation, following the existing pattern of `mergeAgents`/
   `parseAgentsMessage` as small pure functions with their own test files.
3. A new hook (or an addition to `useKeyboardMovement`) listens for the `E`
   key. On press, if `findNearbyVillager` currently returns a villager,
   dialogue opens for that villager's id, with a 4-second auto-dismiss timer
   started immediately.
4. `AgentScene` renders two kinds of floating HTML overlays, positioned each
   frame by projecting the relevant villager's 3D position to 2D screen
   coordinates (via `camera.project`), matching how a canvas overlay already
   tracks 3D content:
   - **"Press E" prompt**: shown above the closest in-range villager
     whenever `findNearbyVillager` returns non-null and no dialogue is
     currently open.
   - **Speech bubble**: shown above the talking villager's head with their
     `name` and `line`, replacing the prompt, for up to 4 seconds or until
     the player moves out of range (whichever comes first).
5. Moving out of range while a bubble is showing dismisses it immediately,
   without waiting for the 4-second timer.

## Testing approach

Same split as phase 2: real unit tests for logic, manual verification for
feel.

- Backend: unit test that `Agent.to_dict()` includes `name`/`role`/`line`,
  and that the three configured villagers carry their configured identity
  through `Store`/the initial payload.
- Frontend: unit tests for `findNearbyVillager` — returns `null` when
  nothing is in range, returns the single in-range agent, returns the
  *closest* one when multiple are in range, and respects the exact range
  boundary (at `rangeTiles`, just inside, just outside).
- Manual/browser verification: walk up to each of the three villagers,
  confirm the "Press E" prompt appears, press E and confirm the correct
  name + line shows in a bubble above their head, confirm it disappears
  after ~4 seconds, and confirm walking away early dismisses it immediately.

## Definition of done

- Each of the three villagers has a distinct name, role, and line, visible
  in the frontend's data (not just the backend).
- Walking within 3 tiles of a villager shows a "Press E" prompt above them.
- Pressing E while in range opens a speech bubble with that villager's name
  and line.
- The bubble disappears on its own after ~4 seconds, or immediately if the
  player walks out of range first.
- Only the single closest villager is ever prompted/talked to at a time,
  even if two are simultaneously in range.

## Key decisions and why (for future reference, avoid relitigating)

- **One fixed line per villager, not several.** Keeps this phase's scope to
  "wire up the pipe," not "write a lot of flavor text." Rotating lines are
  an easy, additive follow-up once the pipe exists.
- **Identity fields sent once, not every broadcast**, for the same reason
  buildings are: they're static, so repeating them ~2x/second forever would
  be pure waste.
- **Proximity/key-trigger logic lives entirely in the frontend**, matching
  how camera pan/zoom is already frontend-only. The backend's job is
  simulation truth; deciding what the player can currently do about it is
  presentation logic.
- **Speech bubbles are HTML overlays projected onto 3D positions, not 3D
  meshes.** Keeps text crisp at any zoom level and reuses a well-understood
  technique rather than building text-in-3D-space (which would look blurry
  when zoomed and needs its own font/material setup).
- **Talk range (3 tiles) is a plain constant, not configurable per
  villager.** No current villager needs a different range; a per-villager
  override can be added later if one ever does.
- **Talk range is sent from the backend, not duplicated as a separate
  frontend constant.** The backend is already the single source of truth
  for buildings and villager identity — a hand-copied number in two
  codebases would drift the moment one side changes without the other.
