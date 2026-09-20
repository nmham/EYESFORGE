# Multitask

Select Multitask 4 or Multitask 5, then Start. Multitask 4 stops adding tasks
after flight starts at 30 seconds and continues with those four tasks.
Multitask 5 also adds the minimap at 40 seconds. Retry preserves the selection.
Both modes use survival seconds rather than the
normal 30/60/120-second session limit. Existing modes and scores are unchanged.
Keyboard and mouse are required; there are no touch-only substitute controls.

## Rules

At the start and when each new task appears, instructions are shown inside its
pane. All task timers, motion, and survival score pause until Continue is clicked.
Gameplay keys cannot dismiss the instructions. Both variants use this behavior.

- 0 seconds: three enlarged 2HP targets (about 30% larger than the initial version).
  Drawing and hit testing use the same responsive radius, capped at 58px.
  Each must be destroyed within 10 seconds
  of spawning. A hit does not reset its deadline. A destroyed target refills
  immediately. Clicking outside a target is ignored; it does not end the game,
  change HP, or extend target deadlines.
- 10 seconds: add a WS-only vertical dodge pane. A/D does not move this player.
  A dashed warning line precedes each
  projectile by 1.0 seconds; projectiles spawn every 1.6 seconds.
- 20 seconds: add an AD horizontal position task. Reach the green zone and stay
  there continuously for one second, within ten seconds per destination.
  Leaving resets hold progress; success selects a different destination.
- 30 seconds: add a gentle float pane. Hold Space to rise, release to descend
  slowly, with smoothed velocity (0.22 pane heights/s up, 0.12 down).
  Floor and ceiling contact are safe. Red obstacles travel from right to left,
  alternating between upper and lower positions every five seconds, covering
  20-32% of the height and moving at 0.15 pane widths/s. Collision with the
  inner 7px of the floating orb ends the run. The first obstacle appears after
  four seconds. Floor and ceiling remain safe.
- 40 seconds: add a fifth pane with an original LoL-style lane diagram.
  Click the requested TOP, MID or BOT lane within six seconds. The next request
  arrives three seconds after a correct answer. Wrong lanes end the game.
- All activated tasks continue together. Any failure ends the run. Retry resets
  every task. Escape/Exit returns to the menu.
- Losing focus ends the run rather than allowing unobserved gameplay.
- The five-task personal best is stored under eyesforge-multitask-best-v1.
  The four-task best is separate under eyesforge-multitask-4-best-v1.
  Storage failure does not prevent gameplay. No online leaderboard is used.

Desktop uses one pane, two columns, three columns, then a 2x2 layout.
The fifth stage has three upper panes and two lower panes. Smaller
windows use a 2x2 layout from the third task. Coordinates and physics are
normalized; canvas rendering supports device pixel ratio up to 2.

## Checks

Run node tests/multitask.browser.cjs with Playwright available via NODE_PATH.
Tests cover two-hit replenishment, task-boundary fixtures, input, collision,
falling, deadline failures, wrong/correct lanes, retry, exit, and rendered pixels.
Boundary fixtures isolate the four tasks; they are not a human-playability
assessment of a continuous 60-second run. Difficulty values are initial tuning.
