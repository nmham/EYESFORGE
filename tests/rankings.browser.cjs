const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const url = pathToFileURL(path.resolve(__dirname, "../peripheral-vision-trainer.html")).href;
const storageKey = "peripheralVisionTrainer.rankings.v1";
const otherRecord = { score: 9, accuracy: 90, reaction: 300, duration: 60 };
const scenarios = [
  ["null root", "null"],
  ["array root", "[]"],
  ["malformed JSON", "{broken"],
  ["invalid rows alongside a valid other event", JSON.stringify({
    "single-static-30": [null, {}, { score: "bad", accuracy: 90, reaction: 300 }],
    "grid-static-60": [otherRecord],
  })],
];

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const [name, raw] of scenarios) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
      try {
        // Isolated browser storage; never modifies the player's current profile.
        await context.addInitScript(({ storageKey, raw }) => localStorage.setItem(storageKey, raw), { storageKey, raw });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.clock.install();
        await page.goto(url);
        await page.locator("#ackSafetyBtn").click();
        await page.locator('[data-duration="30"]').click();
        assert.equal((await page.locator("#rankingList").textContent()).trim(), "No Records");
        await page.locator("#startBtn").click();
        await page.locator(".target").click({ button: "right" });
        assert.equal(await page.locator("#score").innerText(), "1");
        await page.clock.runFor(30_000);
        assert.equal(await page.locator("#results").isVisible(), true);
        assert.equal(await page.locator("#resultScore").innerText(), "1");
        const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
        assert.equal(stored["single-static-30"].length, 1);
        assert.equal(stored["single-static-30"][0].duration, 30);
        if (name.startsWith("invalid rows")) {
          assert.equal(stored["grid-static-60"][0].score, otherRecord.score);
          assert.equal(stored["grid-static-60"][0].duration, 60);
        }
        await page.locator("#retryBtn").click();
        assert.equal(await page.locator(".target").count(), 1);
        assert.deepEqual(errors, []);
        console.log(`PASS: ${name}: menu, right-click hit, timed result, save, retry`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
