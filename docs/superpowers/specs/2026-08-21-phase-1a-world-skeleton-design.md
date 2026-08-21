# Phase 1a: World Skeleton — Grid + One Moving Point

Status: draft, pending review
Related: `VISION.md`, `IDEAS.md`

## What this phase is

The smallest provable slice of the whole project: a backend that owns a grid
and one agent's position, a tick loop that moves the agent, a live sync
channel to the frontend, and a frontend that renders that movement as a
3D shape. This proves the core architectural loop end to end — backend owns
state, frontend only renders, movement happens on its own without blocking
anything — before any real complexity (zones, multiple agents, dialogue,
LLM-driven behavior) gets added.

## Explicitly out of scope for this phase

- Zones (cafe, market, dock, etc.) — deferred, to be built incrementally later
- Multiple agents — just one
- Player-controlled movement — the point moves on its own (tick-driven), not
  via player input
- Dialogue, roles, memory, LLM calls — none of this exists yet
- Persistence — state lives in memory in the backend process only; resets on
  restart

## Architecture

Backend and frontend are fully separated, per the project's core
architecture direction:

- **Backend** (Python + FastAPI) owns all simulation state and is the only
  thing that changes it. It runs a tick loop that periodically advances the
  agent's position, independent of whether anyone is connected or watching.
- **Frontend** (React + Three.js) is a pure renderer. It holds no
  authoritative state — it receives position updates and draws them. It
  never computes movement itself.
- **Sync**: a WebSocket connection pushes the agent's position from backend
  to frontend the moment it changes (after each tick). This is real-time
  push, not the frontend polling for state.

## Data model

- **Grid**: fixed dimensions (~20x20 to 30x30 tiles), discrete tile
  coordinates. No zone data yet — just a coordinate space with bounds.
- **Agent**: a single agent with an `(x, y)` tile position. No role, no
  memory, no name required for this phase — just enough to exist and move.
- **Movement**: discrete, tile-to-tile (not continuous/free position).
  4-directional only (up/down/left/right) — no diagonals, matching a
  classic Game Boy-era Pokémon movement model.

## Backend behavior

1. On startup, initialize the grid and place the agent at a starting
   position.
2. Run an async tick loop on an interval (e.g. every 500ms) that advances
   the agent one tile in a direction, respecting grid bounds. Movement
   logic for this phase is intentionally simple/non-intelligent: cycle
   through a fixed sequence of directions (e.g. up, right, down, left,
   repeat), reversing or skipping a step at grid edges — the goal is
   proving the loop runs continuously and asynchronously, not smart
   behavior.
3. After each tick, broadcast the agent's updated position to all connected
   WebSocket clients.

## Frontend behavior

1. Render a flat ground plane sized to the grid, using a perspective
   camera (matches the murmur.living reference lean; the actual visual
   difference vs. orthographic is negligible at this scope and cheap to
   change later).
2. Connect to the backend's WebSocket endpoint on load.
3. On each position update received, move a 3D low-poly placeholder shape
   (standing in for the eventual agent model) to the corresponding tile
   on the ground plane.
4. Aesthetic: low-poly/retro-polygon look (not pixel art), built from
   Three.js primitive geometries (box/cone/cylinder/icosahedron-style
   shapes) with Three's built-in lighting — no custom shader-writing
   required for this phase.

## Testing approach

This phase is a rendering + real-time-sync proof, so its primary
verification is visual/manual: does the shape visibly move on screen when
the backend's tick advances its position, without any page refresh or
manual re-fetch. Any backend logic with real branching (bounds checking,
direction cycling) gets normal unit tests. No test coverage is expected for
the Three.js rendering code itself at this stage.

## Definition of done

- Backend process runs, holds grid + agent state, ticks on an interval,
  and broadcasts position updates over WebSocket.
- Frontend connects, renders a flat grid plane and one 3D low-poly shape,
  and that shape visibly moves in the browser as ticks happen — with zero
  manual refresh.
- No zones, no second agent, no dialogue, no LLM calls exist anywhere in
  this phase's code.

## Key decisions and why (for future reference, avoid relitigating)

- **Renderer: Three.js**, not PixiJS or Phaser. Decided after extensive
  comparison — the deciding factor was the user's aesthetic goal (low-poly
  geometric/polygon shapes, explicitly not pixel art), which only a true 3D
  renderer can produce; PixiJS and Phaser are 2D-only and cannot render
  that look regardless of preference. Three.js also provides built-in
  lighting/materials, avoiding hand-written shader work the user explicitly
  didn't want to take on.
- **Movement: discrete grid, 4-directional**, matching the user's own
  reference point (classic Pokémon).
- **Backend: Python + FastAPI**, chosen for native async/WebSocket support
  (fits the "agent thinking runs async without blocking the world" direction
  from `VISION.md`) and the strongest available LLM/agent tooling for when
  later phases need it.
- **Camera: perspective**, matching the murmur.living reference; the
  orthographic alternative was confirmed to have no meaningful trade-off at
  this scope and is a cheap change later if wanted.
- **Godot** is a possible native port far in the future and is explicitly
  out of scope for all near-term decisions — it should not influence any
  phase 1 choice.
