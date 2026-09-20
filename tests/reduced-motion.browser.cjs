const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const reducedMotion of ["reduce", "no-preference"]) {
      const page = await browser.newPage({ reducedMotion, viewport: { width: 1600, height: 1200 } });
      try {
        await page.goto(pathToFileURL(path.resolve(__dirname, "../peripheral-vision-trainer.html")).href);
        const rotation = await page.locator(".reticle-orbit").evaluate((element) => {
          const style = getComputedStyle(element);
          return { name: style.animationName, duration: parseFloat(style.animationDuration) };
        });
        assert.equal(rotation.name, "reticleSpin");
        assert.equal(rotation.duration, 8, "Both preferences must retain the same 8-second rotation");
        await page.locator("#ackSafetyBtn").click();
        await page.locator("#startBtn").click();
        await page.locator(".target").click();
        assert.equal(await page.locator("#score").textContent(), "1");
        const effect = await page.locator(".hit-burst").evaluate((element) => {
          const style = getComputedStyle(element);
          return { duration: parseFloat(style.animationDuration), opacity: Number(style.opacity), name: style.animationName };
        });
        assert.ok(effect.duration >= 0.3, "Hit feedback must last long enough to see");
        assert.ok(effect.opacity > 0, "Hit feedback must still be visible just after the hit");
        assert.equal(effect.name, "burst");
        assert.equal(effect.duration, 0.36);
        await page.locator(".hit-burst").waitFor({ state: "detached" });
        assert.equal(await page.locator(".target").count(), 1);
        console.log("PASS: " + reducedMotion + ": rotation, menu, scoring, visible hit effect, effect cleanup");
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
