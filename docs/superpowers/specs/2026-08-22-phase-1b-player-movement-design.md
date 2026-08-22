# Phase 1b: Player-Controlled Movement

Status: approved
Related: `VISION.md`, `IDEAS.md`, phase 1a spec (`docs/superpowers/specs/2026-08-21-phase-1a-world-skeleton-design.md`)

## What this phase is

Phase 1a proved the world runs on its own — a villager walks itself around
the board and every connected browser sees it live. Phase 1b adds the one
thing phase 1a never touched: the player. A new `Player` moves in response
to your keypresses, rendered as a distinct shape in the same live 3D scene,
using the same WebSocket connection that already streams villager
positions — now made two-way.

## Explicitly out of scope for this phase

- Multiple simultaneous players (real multiplayer) — one global `Player`,
  shared by however many browser tabs are connected.
- Camera following the player — camera stays fixed, whole board visible,
  exactly as phase 1a built it.
- Collision between the player and the villager, or any hitbox/collision
  system — both simply occupy the grid independently; walking onto the same
  tile as the villager has no special effect.
- Any shared `Entity` base class for `Agent`/`Player` — noted in `IDEAS.md`
  as worth revisiting once buildings/objects and real hitboxes are designed;
  not built now. `Agent` and `Player` stay as two small, separate classes.
- Dialogue, interaction, roles, memory — still not this phase.
- The canvas-sizing/white-edges rendering issue noticed during this
  session's testing — a separate, unrelated bug, tracked on its own.

## Architecture

The backend's WebSocket connection, one-way in phase 1a (backend → browser
only), becomes two-way: it still pushes state out on every change, and now
also listens for movement commands coming in. A new `Player` — a small
concept with its own `(x, y)` position, matching `Agent`'s shape but
tracked separately in the `Store` — moves the instant a valid command
arrives, independent of the villager's own 0.5s auto-walk timer. Both
`Player` and `Agent` reuse the same `Grid.in_bounds()` bounds check phase
1a already built.

## Data model

- **`Player`**: `{id, x, y}` — same shape as `Agent`, for the same reason
  `Agent` has an `id` (future-proofing, consistency). Exactly one exists,
  set up from named config constants (`PLAYER_START_ID`, `PLAYER_START_X`,
  `PLAYER_START_Y`), the same pattern `Agent`'s config already follows.
- **Outgoing broadcast shape** (backend → browser, extends phase 1a's
  `{"agents": [...]}` payload):
  ```json
  {"agents": [{"id": "villager-1", "x": 10, "y": 9}], "player": {"id": "player-1", "x": 5, "y": 5}}
  ```
- **Incoming move command** (browser → backend, new):
  ```json
  {"type": "move", "direction": "up"}
  ```
  `direction` is one of `"up" | "down" | "left" | "right"` — same
  4-directional, no-diagonal movement model as the villager.

## Backend behavior

1. On startup, create the `Player` at its configured starting position,
   alongside the existing `Grid` and villager `Agent` setup.
2. The WebSocket endpoint, in addition to sending state on connect, now
   also listens for incoming text messages on the same connection. When a
   `{"type": "move", "direction": "..."}` message arrives:
   - Compute the target tile from the player's current position and the
     given direction.
   - If `Grid.in_bounds()` accepts it, update the player's position.
     If not, ignore the command — the player simply doesn't move that step
     (no direction-cycling like the villager's auto-walk; that behavior is
     specific to the villager's scripted movement, not player input).
   - Broadcast the full current state (villagers + player) to every
     connected client immediately — not waiting for the next scheduled
     tick, since this is a direct response to player action.
3. The villager's existing tick loop is untouched — it keeps auto-walking
   on its own 0.5s timer, broadcasting on its own schedule, completely
   independent of player input. Two independent things changing the same
   shared world, each broadcasting through the same `ConnectionManager`.
4. Malformed incoming messages (bad JSON, unknown `type`, invalid
   `direction`) are ignored rather than crashing the connection — the
   backend simply doesn't act on anything it doesn't recognize.

## Frontend behavior

1. The WebSocket hook from phase 1a (`useAgentPositions`) is renamed and
   expanded to `useGameConnection`. It still receives and parses live
   state (now including the `player` field, not just `agents`), and now
   additionally exposes a `sendMove(direction)` function that sends a move
   command over the same open connection.
2. A keyboard listener (arrow keys, with WASD as an alias) calls
   `sendMove('up' | 'down' | 'left' | 'right')` on keypress, and again on
   every repeat-fire while a key is held down — no manual debounce, this
   is deliberately simple and matches how classic tile-based games behave
   (hold a direction, keep walking that way).
3. `AgentScene` gains a `player` prop alongside its existing `agents` prop.
   The player is rendered as its own mesh — a yellow `TetrahedronGeometry`
   (a four-triangular-faced solid), visually distinct from the villager's
   rounded, tan/orange `IcosahedronGeometry` — using the same
   create-on-first-appearance / update-position pattern already built for
   villager meshes.

## Testing approach

Backend movement logic (bounds checking, applying a valid move, ignoring
an invalid one, ignoring malformed messages) gets real unit tests, the
same TDD discipline as phase 1a. The WebSocket becoming bidirectional and
the actual live, responsive feel of pressing a key and seeing the player
move gets verified manually in a real browser — the same category of
thing phase 1a's live-movement check was, and for the same reason
(there's no good automated way to assert "this felt responsive").

## Definition of done

- Pressing an arrow key in the browser moves the yellow player shape one
  tile in that direction, immediately, with zero manual refresh.
- The player cannot walk off the edge of the board.
- The villager keeps auto-walking exactly as it did in phase 1a, unaffected
  by player movement.
- Both the player and the villager are visible at once, clearly
  distinguishable from each other by shape and color.
- Malformed or out-of-bounds move commands don't crash the backend or
  disconnect the browser.

## Key decisions and why (for future reference, avoid relitigating)

- **`Player` is a distinct concept, not another `Agent`.** Matches
  `VISION.md`'s treatment of the player as something villagers form
  opinions *about* — conceptually separate from villagers from the start,
  even though today it's structurally almost identical to `Agent`.
- **Movement commands travel over the same WebSocket connection**, not a
  separate REST endpoint. Chosen for lower latency (no new connection
  setup per keypress — writing to an already-open socket) and simpler
  integration (one connection to manage instead of two channels that could
  drift out of sync with each other).
- **Player movement is immediate on keypress**, not synced to the
  villager's tick cadence. Chosen for responsive, standard game-feel over
  a simpler-but-laggier single-shared-timer design.
- **Camera stays fixed** (phase 1a's existing camera, unchanged). The
  board is small enough that the whole thing is already visible at once —
  camera-follow is real added complexity (smooth movement, edge behavior)
  with no payoff at this scale yet.
- **No shared `Entity` base class for `Agent`/`Player` yet.** The two
  classes' only real overlap today is `{id, x, y}` — a shared base class
  would save almost no code now, and a real reason to share behavior
  (hitboxes, once buildings/objects exist) isn't designed yet. Building it
  now risks guessing the wrong shape and having to redo it once hitboxes
  are real. Noted in `IDEAS.md` as a "when buildings/hitboxes get designed"
  consideration, not built now.
- **Player id/start position come from named config constants**, mirroring
  exactly how `Agent`'s config already works — consistency over inventing
  a new pattern for one more entity.
