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
