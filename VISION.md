# VISION.md

## What This Is

A coastal town simulation, viewed top-down (Pokémon-style), inhabited by villager
agents who live independent lives — they have roles, relationships, memory, and
routines. The player walks around the town and can talk to any villager. Music
is part of the atmosphere, not an afterthought.

This is not a scripted NPC demo. Villagers should feel like they have an inner
life: they remember past interactions, form opinions about each other and the
player, trade, work their roles, and — over time — the town itself should show
signs of progress (buildings, resources, visible change) driven by what the
agents do, not by the player alone.

Each villager has a story — not a static bio, but one that shifts as the world
evolves. Their past experiences shape how they see themselves and each other
over time: a debt gets paid off, a rivalry cools, a loss keeps resurfacing in
how they talk. This can start simple (a written backstory that colors
personality and dialogue) and grow into something that genuinely updates from
lived events.

## What "Done" Feels Like

You open the project, you're standing in a small coastal town. You can walk
around. Villagers are going about their day — fishing, running a market stall,
sitting at the cafe. You walk up to one and talk to them, and what they say
reflects what's actually happened in the town: a trade they made, a rumor
they heard, how they feel about you from last time. Watching the town for a
few minutes without touching anything, it still feels alive.

## Core Pillars (the things that must not get lost)

1. Agents have persistent memory and relationships — not stateless chatbot
   responses. This is the technical and creative core of the project.
2. Villagers' stories evolve — who they are shifts based on what actually
   happens to them, not a backstory frozen at creation.
3. The player is embedded in the world, not just observing it — you can
   walk around and talk to agents directly.
4. The town evolves over time — visible signs of progress or change driven
   by agent behavior, not just a static backdrop.
5. It has a specific mood — coastal, musical, alive — not a generic grid
   simulation. Aesthetic matters as much as architecture here.

## Explicit Non-Goals (for now)

- Not trying to be a full game with combat, quests, or win conditions.
- Not trying to support many dozens of agents at launch — a handful of
  well-realized villagers beats a crowd of shallow ones.
- Not committing to a rendering engine forever — backend/frontend are
  separated on purpose so the renderer can change without touching the
  simulation.

## How I Want to Work On This

I build progressively, one concrete piece at a time. Each session has ONE
task. New ideas that come up mid-build go in IDEAS.md, not into the current
task's scope. This file is the anchor I return to if I feel the direction
drifting — if a decision doesn't serve one of the Core Pillars above, it
probably belongs in "someday," not "now."
