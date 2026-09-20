# Tests

Run from the repository root with Node.js 18 or newer:

```sh
node --test tests/*.test.mjs
node --check sw.js
```

No packages or installation are required. Tests execute the actual service worker
in a Node VM with CacheStorage and lifecycle event doubles. They cover cache
ownership, release cleanup, first installation, asynchronous completion, and
failure propagation. Ranking tests extract the actual HTML's ranking functions
and exercise malformed storage, partial recovery, saving, rendering, old records,
sorting, and unavailable storage with minimal DOM doubles.

Optional browser smoke test (requires Playwright and an installed Microsoft Edge):

```sh
node tests/rankings.browser.cjs
node tests/attack-move.browser.cjs
node tests/reduced-motion.browser.cjs
```

Make Playwright available through local dependencies or `NODE_PATH`. Set
`BROWSER_CHANNEL=chrome` to use an installed Chrome instead. The script uses
isolated browser contexts and does not modify the player's browser data. It tests
four corrupt-storage scenarios through menu, right-click hit, 30-second game
completion using a virtual clock, record persistence, and retry. It opens the
actual HTML as a local file, matching the standalone distribution.

Browser registration, real offline navigation, and the other game modes are not
covered by this smoke test.

The Attack Move test checks the large cyan MOVE zone before each A-then-left-click,
zone separation and cleanup, persistent MOVE visibility, three-use position groups,
3HP targets that stay in place until destroyed, background/UI exclusion, cancellation by right-click,
single-use arming, key-repeat rejection, right-click-only MOVE with left-click ignored,
no forgiving hits outside targets,
separate ranking persistence, and normal-mode right-click behavior. It uses
mouse coordinates for shots to avoid locator-driven scrolling of the stage.

The reduced-motion test runs both motion preferences in Edge and checks decorative
rotation, menu visibility, scoring, visible hit-feedback duration, and cleanup.
