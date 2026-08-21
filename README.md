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

Currently in **Phase 1a**: a backend-owned grid with one agent whose
position ticks and streams live to a Three.js frontend. See the
[phase 1a spec](./docs/superpowers/specs/2026-08-21-phase-1a-world-skeleton-design.md)
for details. Nothing is implemented yet beyond project scaffolding.

## Architecture (early)

- `backend/` — Python + FastAPI. Owns all simulation state; the only thing
  that changes it. See `backend/app/` for the module layout.
- Frontend (not yet scaffolded) — React + Three.js, renders whatever state
  the backend sends over WebSocket. Never computes state itself.
