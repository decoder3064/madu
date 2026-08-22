# Madu

A coastal "Mini-Town" simulation: a 2D world inhabited by villager agents with
distinct roles who trade, talk, form relationships, and remember past
interactions. The player can walk around the town and talk to any villager
directly. Villager backstories aren't static — their memories of past events
feed back into their sense of self and relationships over time.

This is a portfolio project focused on real systems engineering: async
orchestration, event-driven state, and agent memory — not a chat wrapper.

See [`VISION.md`](./VISION.md) for the full vision, core pillars, and
non-goals. See [`docs/superpowers/specs/`](./docs/superpowers/specs/) for
phase-by-phase design specs.

## Status

**Phase 1a is complete**: the backend owns a grid and a collection of agents,
ticks their positions on a timer, and streams live updates over WebSocket to
a Three.js frontend that renders each agent as a moving 3D low-poly shape.
See the
[phase 1a spec](./docs/superpowers/specs/2026-08-21-phase-1a-world-skeleton-design.md)
and [phase 1a plan](./docs/superpowers/plans/2026-08-21-phase-1a-world-skeleton.md)
for full details. See [`IMPORTANT_NOTES.md`](./IMPORTANT_NOTES.md) for
known gaps and things worth remembering before extending this.

## Running it

Two terminals, both from the repo root:

**Backend:**
```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8420
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173` or the
next free port). Port **8420** is used instead of the more common 8000
because 8000 is commonly used by other local projects — see
`IMPORTANT_NOTES.md` for why this matters if you ever change it.

## Architecture

- `backend/` — Python + FastAPI. Owns all simulation state; the only thing
  that changes it. See `backend/app/` for the module layout.
- `frontend/` — React + Three.js. Renders whatever state the backend sends
  over WebSocket. Never computes state itself.
