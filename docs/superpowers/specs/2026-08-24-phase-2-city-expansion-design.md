# Phase 2: City Expansion — Buildings, Hitboxes, More Villagers

Status: approved
Related: `VISION.md`, `IDEAS.md`, phase 1a spec
(`docs/superpowers/specs/2026-08-21-phase-1a-world-skeleton-design.md`), phase
1b spec (`docs/superpowers/specs/2026-08-22-phase-1b-player-movement-design.md`)

## What this phase is

Phase 1b proved a player can move around a live, shared world alongside one
auto-walking villager. Phase 2 turns that empty board into something closer
to a town: the grid grows from 20x20 to 50x50, two more villagers join (three
total), two static buildings occupy real space on the board, and everything
that moves now respects those buildings as physical obstacles — behind a
dev-only on/off switch so collision can be tested without getting in the way
during development. Villagers also stop moving continuously and instead
alternate between walking for a while and resting for a long while, so the
town doesn't feel like it's endlessly pacing.

## Explicitly out of scope for this phase

- **AI-driven or scripted decision-making.** Villagers keep the exact
  movement pattern phase 1a already built (walk in a straight line, turn 90°
  when blocked) — just wrapped in a walk/rest cycle and now also blocked by
  buildings. Real "decide where to go" logic is its own future phase.
- **Pathfinding.** Villagers don't route around buildings intelligently —
  they just treat a building edge the same way they treat the grid's edge:
  turn and keep going.
- **Full physics.** No sliding, no partial overlap, no angled collision.
  A tile is either walkable or it isn't.
- **Building interaction.** Buildings are inert obstacles this phase — no
  entering, no purpose, no interior. Just boxes that block movement.
- **Full UI polish.** Just enough visual clarity to read as a sandbox: gray
  building boxes, a visible grid edge, a camera that fits the bigger board.
  No lighting overhaul, no textures, no UI chrome.
- **More than two buildings.** The design supports adding more later
  trivially (each is just a config entry), but only two get built now.

## Architecture

A new abstract `Entity` base class becomes the shared shape for everything
that occupies space in the world: an `id`, a position (`x, y`), and a
footprint (`width, height`, defaulting to a single tile). "Abstract" means
`Entity` itself can never be created directly — only its subclasses can —
enforced by Python's `ABC` machinery, not just by convention. `Agent`,
`Player`, and the new `Building` all become concrete subclasses. Each must
define its own `to_dict()` (`Entity` marks it as required but doesn't
implement it), since a building's dict needs `width`/`height` and a
villager's doesn't.

Collision becomes a single generic check: is the target tile inside any
entity's footprint that isn't the mover itself. Buildings are the only
non-mover entities with a footprint bigger than one tile today, so in
practice this phase means "is the target tile inside a building" — but the
check itself doesn't hardcode that, so a future stationary entity (a tree, a
well) gets collision for free.

Villager movement gains a walk/rest state machine, layered on top of the
existing per-villager direction-cycling logic from phase 1a — it isn't
replaced, just gated by whether the villager is currently allowed to move.

## Data model

- **`Entity` (abstract)**: `id: str`, `x: int`, `y: int`, `width: int = 1`,
  `height: int = 1`. Declares `to_dict() -> dict` as required, no
  implementation.
- **`Agent`, `Player`**: unchanged shape (`{id, x, y}` — 1x1 footprint,
  inherited default), now subclass `Entity` instead of standing alone.
- **`Building(Entity)`**: `{id, x, y, width, height}`, both dimensions fixed
  at `BUILDING_SIZE = 5`. Config-defined positions, adjusted from the
  earlier casual proposal to avoid overlapping the existing villager/player
  start tiles:
  - `BUILDING_1`: id `"building-1"`, top-left corner `(15, 15)` → occupies
    tiles (15,15) through (19,19)
  - `BUILDING_2`: id `"building-2"`, top-left corner `(35, 35)` → occupies
    tiles (35,35) through (39,39)
- **New config constants** (`backend/app/core/config.py`):
  ```
  GRID_WIDTH = 50
  GRID_HEIGHT = 50
  AGENT_2_START_ID = "villager-2"
  AGENT_2_START_X = 25
  AGENT_2_START_Y = 10
  AGENT_3_START_ID = "villager-3"
  AGENT_3_START_X = 10
  AGENT_3_START_Y = 25
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
- **Outgoing initial payload** (sent once, on connect only — buildings never
  change, so there's no reason to repeat them on every broadcast):
  ```json
  {
    "agents": [...], "player": {...},
    "buildings": [{"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5}, ...]
  }
  ```
- **Outgoing periodic broadcast** (unchanged shape from phase 1b — no
  `buildings` key, since the frontend already has them from the initial
  payload):
  ```json
  {"agents": [...], "player": {...}}
  ```

## Backend behavior

1. **Hitbox check**: a new function (e.g. `is_blocked(x, y, buildings) ->
   bool`) returns whether a tile falls inside any building's footprint.
   Both the player's `apply_move` and the villager's `Simulation._advance`
   call it — but only when `HITBOXES_ENABLED` is `True`. When the flag is
   `False`, this check is skipped entirely and buildings become purely
   visual, walkable obstacles — useful for testing movement without
   collision in the way.
2. **Walk/rest cycle**: `Simulation` tracks, per villager, whether it's
   currently walking or resting and a countdown (in ticks, derived from
   `TICK_INTERVAL_SECONDS`) until the next switch. On `tick()`:
   - If resting: decrement the countdown; if it hits zero, switch to
     walking and pick a new random walk duration (from the configured
     min/max range). Don't move this tick either way.
   - If walking: decrement the countdown; if it hits zero, switch to
     resting and pick a new random rest duration. Otherwise, attempt to
     move one tile using the existing direction-cycling logic, now also
     turning when the target tile is blocked by a building (not just the
     grid edge).
   - Each villager's initial walk/rest countdown is randomized
     independently, so all three don't sync up.
3. **Buildings are created once at startup**, alongside the grid, agents,
   and player, and never change — no `set_building_position` or similar
   exists, since nothing this phase moves a building.

## Frontend behavior

1. `useGameConnection` gains a `buildings` field, populated once from the
   initial connect message (a new `parseBuildingsMessage`, following the
   same parsing pattern as `parseAgentsMessage`/`parsePlayerPosition`) and
   never updated again afterward — matching the backend only ever sending
   it once.
2. `AgentScene` renders each building as a plain gray box (`THREE.BoxGeometry`
   sized to its footprint, positioned at its top-left corner) — created once
   when the `buildings` prop first arrives, no per-tick diffing needed since
   buildings never move or change.
3. `GRID_SIZE` becomes 50 (from 20); the camera position/distance is
   adjusted so the full board is visible, replacing phase 1a's constants
   tuned for the smaller board.
4. A visible border around the grid's edge (a simple wireframe box or line
   loop at the board's perimeter) makes the 50x50 world read as a defined
   space rather than fading into the background.

## Testing approach

Same discipline as 1a/1b: real unit tests for logic (hitbox detection
against building footprints, walk/rest countdown transitions and random
range bounds, building placement, the flag correctly disabling collision).
Rendering and "does it feel like a town" — box colors, grid edge visibility,
camera framing at the bigger scale — gets verified manually in a real
browser, since there's no meaningful automated assertion for how a 3D scene
looks.

## Definition of done

- Three villagers visible and auto-walking (when not resting) on a 50x50
  board.
- Two gray building boxes visible at their configured positions.
- With `HITBOXES_ENABLED = True`: neither villagers nor the player can walk
  onto a building's tiles; they turn away instead, same as hitting the
  grid's edge.
- With `HITBOXES_ENABLED = False`: villagers and the player walk through
  buildings unobstructed (buildings still render, just don't block).
- Each villager alternates between walking (1-2 minutes) and resting (5-6
  minutes), independently timed from the other two.
- The grid's edge is visually apparent, and the camera shows the full board.

## Key decisions and why (for future reference, avoid relitigating)

- **`Entity` is abstract**, closing out the note phase 1b's spec left open
  ("worth revisiting once buildings/objects and real hitboxes are
  designed"). It's not just a defensive guard — `Entity` doesn't correspond
  to anything real in the game, only villagers/players/buildings do, so
  making it impossible to instantiate directly encodes that fact in the
  code rather than relying on convention.
- **Hitbox checking is a single generic function over footprints**, not
  building-specific logic, so future stationary entities get collision for
  free without new code.
- **Villager building positions were adjusted** from the earlier casual
  `(10,10)`/`(32,32)` proposal — `(10,10)` collides with `villager-1`'s
  existing start tile from phase 1a. Moved to `(15,15)` and `(35,35)` to
  keep clear of every existing entity's starting position.
- **Walk/rest timing uses tick counts, not wall-clock timestamps.** Ticks
  are already the simulation's unit of time (`TICK_INTERVAL_SECONDS`), and
  counting down an integer is simpler to unit-test deterministically than
  comparing against real elapsed time.
- **Buildings are sent once, on connect, not on every periodic broadcast.**
  They never change, so repeating them ~2x/second forever would be pure
  waste — unlike the villager/player broadcast, which has to repeat because
  positions actually change.
- **Hitboxes are a single global config flag**, not a per-entity or
  per-request toggle. This phase only needs a blunt dev on/off switch, not
  fine-grained control.
