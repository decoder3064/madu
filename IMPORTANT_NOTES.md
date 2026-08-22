# Important Notes

Observations from code review during implementation — nothing here needs fixing
right now, but worth remembering for later. Each entry says which task it came
from and why it doesn't need action today.

## Task 1: Backend project setup

- `backend/.venv` (the private Python environment folder) isn't explicitly
  excluded from git in this task's own files, but the project's root
  `.gitignore` already covers it — no action needed.

## Task 2: Grid

- `Grid` doesn't check for a negative or zero width/height when created —
  e.g. `Grid(width=-1, height=5)` would silently build a broken board. Not
  requested, and nothing currently creates a Grid with bad numbers.
- Test coverage checks the right edge of the board but not symmetrically the
  bottom edge. Not requested, purely a "could test more" note.

## Task 3: Agent

- No test for a negative position or an empty name/id. Not requested — the
  class is simple enough that this wasn't seen as necessary.

## Task 4: Store

- Looking up a villager by an id that doesn't exist crashes with a raw,
  unfriendly internal error instead of a clean "not found" message. Not a
  problem yet because nothing currently looks up an id it doesn't already
  know exists. Worth remembering if a future piece of code (e.g. a web
  request handler) ever looks up a villager by an id coming from outside
  the program — that's the moment this would need a proper error message.

## Task 5: Simulation (tick loop)

- Each villager's walking direction gets set up once, when the simulation
  starts, based on whichever villagers exist at that moment. If a future
  version of this project adds a brand-new villager *while the simulation
  is already running* (instead of having it exist from the start), the
  program would crash. Today, villagers are always set up before the
  simulation starts, so this doesn't happen — only matters if "add a
  villager mid-game" becomes a real feature later.

## Task 9: Connecting to the backend

- If the backend ever sends a broken or unexpected message, the frontend
  doesn't handle that gracefully yet — it would fail loudly instead of just
  ignoring the bad message. Not a problem today since the backend always
  sends well-formed messages. Worth revisiting if this project ever adds
  something that could send bad data (a flaky network, a future backend
  bug, etc).

## Task 7: Wiring everything together (main.py)

- Found and fixed a real gap that had been there since Task 1: running the
  tests the exact way the plan documents (plain `pytest`, from inside the
  `backend` folder) actually failed to even load *any* test file, not just
  this task's — every earlier task's tests had only been passing because
  they happened to get run a slightly different way. Fixed by adding one
  line (`pythonpath = .`) to `backend/pytest.ini`. Verified directly: removed
  the line, confirmed all 6 test files broke with the same error, put it
  back, confirmed all 20 tests pass again. This is now fixed — nothing to
  do, just documenting that it was a real, quietly-existing gap and not a
  one-off Task 7 workaround.

## Task 10: The 3D scene

- Found and fixed a real bug via direct browser testing (not caught by code
  review, since it only shows up when actually running): villager shapes
  never appeared on screen, even though the ground rendered fine and the
  position logic was correct. Cause: a React development-only safety check
  runs the scene-setup code once, throws it away, and runs it again — the
  code that remembers "I already made a shape for this villager" survived
  that throw-away-and-redo, so it skipped re-adding shapes to the rebuilt
  scene. Fixed by clearing that memory whenever the scene gets torn down,
  so shapes always get freshly placed into whichever scene actually exists.
  Verified directly by toggling the safety check off/on and watching the
  shapes appear/disappear correspondingly.
- This fix rebuilds every shape from scratch whenever the whole 3D view
  gets torn down and rebuilt (not on every villager move, not on adding a
  new villager — only a full scene rebuild, which should be rare/never in
  normal use). The cost scales with how often the *scene* rebuilds, not
  with how many villagers exist, so this doesn't need revisiting just
  because the town grows. If a full scene rebuild ever becomes frequent for
  some real reason, a more efficient version exists (reuse a shape if it's
  already in the current scene instead of always rebuilding) — that would
  be a small, self-contained change inside this one file, nothing else in
  the project would need to change.
