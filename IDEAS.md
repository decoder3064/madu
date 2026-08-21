# IDEAS.md

Parking lot for ideas that come up mid-build but aren't in scope for the
current session's task. Check against VISION.md's Core Pillars before
promoting anything out of here into actual work.

---

Someday/later ideas — not scoped, not committed, just captured so they don't
get lost or pull focus from the current phase.

## Long-term vision anchor

A village of agents, each with a real backstory that evolves as the world
evolves. Cozy tone — Stardew Valley, not a hardcore sim. Agents evolve in
relation to each other, not just individually. An observability layer to
peek into agent internals (thoughts, memory, relationships) sits at the edge
of the project — something to reach for once the core is alive.

## Agent capabilities (later additions)

- Inventory per agent — items they hold, gather, or carry.
- Tools/skills agents can use or develop over time.
- Gathering mechanics — agents scouting for and collecting resources (e.g. a
  nearby forest to chop, fish to catch).
- Crafting/building — agents constructing things (starting with simple
  objects, potentially working up to houses).
- Visible civilization growth — the town's physical footprint expanding
  over time as a result of agent activity, not player action.

## Social/hangout angle (Club Penguin-inspired)

Original Club Penguin ran on flat 2D sprites in a browser and succeeded on
world/social design, not tech sophistication. Possible angle: less "a
simulation to observe," more "a space to hang out in" — agents with their
own shops and routines, player just drops in and socializes. Most AI-town
projects (Smallville, AI Town) are built to be watched/studied — a
genuinely social hangout space with agents who have real inner lives is a
less explored angle.

## Sonification (mur mur-inspired)

mur mur (murmur.living) generates ambient music in real time from a
simulated world's internal life — weather and agent activity directly drive
the soundscape, not a separate music layer. Possible future feature: agent
actions/events (a trade, a mood shift, weather) trigger musical elements
rather than a static soundtrack playing alongside the visuals. Not scoped —
pure inspiration for now.

## Rendering/engine notes

- Chose Three.js over Pixi.js specifically for future flexibility — can
  start fully flat/2D and grow into isometric/3D without switching engines.
- Godot remains a possible future port for the rendering layer specifically
  (not the backend) if a native/heavier game engine is ever wanted — the
  backend/frontend separation makes this swap possible without touching
  simulation logic. Not a current decision.
- Own game engine (fully from scratch, no library) was considered — full
  control and maximum learning, at the cost of also solving already-solved
  rendering/perf problems. Parked, not chosen.

## Reference points / inspirations

- murmur.living — tiny simulated worlds generating ambient sound in real
  time; the "runs its own life whether or not you're watching" quality.
- Stanford/Google "Generative Agents" (Smallville) — agents with memory,
  routines, and social behavior in a small town.
- AI Town (a16z, open source) — deployable version of the same idea.
- Altera's Project Sid — large-scale agent civilizations in Minecraft,
  emergent role specialization, culture.
- Club Penguin — proof that world/social design matters more than tech
  sophistication; simple 2D sprites, huge emotional pull.
