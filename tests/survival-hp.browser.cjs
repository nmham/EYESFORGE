const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../peripheral-vision-trainer.html")).href);
    await page.locator("#ackSafetyBtn").click();
    assert.equal(await page.locator("#survivalHp").isVisible(), false);
    await page.locator("#survivalBtn").click();
    await page.locator("#startBtn").click();
    assert.equal(await page.locator("#survivalHp").isVisible(), true);
    assert.equal(await page.locator("#survivalHp span:not(.depleted)").count(), 3);
    assert.equal(await page.locator("#survivalHp").evaluate(el => getComputedStyle(el).pointerEvents), "none");
    for (let misses = 1; misses <= 3; misses++) {
      await page.locator(".target").waitFor({ state: "visible" });
      await page.mouse.click(5, 5);
      assert.equal(await page.locator("#survivalHp span:not(.depleted)").count(), 3 - misses);
    }
    assert.equal(await page.locator("#results").isVisible(), true);
    assert.equal(await page.locator("#survivalHp").isVisible(), false);
    await page.locator("#retryBtn").click();
    assert.equal(await page.locator("#survivalHp span:not(.depleted)").count(), 3);
    await page.screenshot({ path: path.resolve(__dirname, "../../survival-hp-preview.png") });
    await page.keyboard.press("Escape");
    await page.locator("#survivalBtn").click();
    await page.locator("#startBtn").click();
    assert.equal(await page.locator("#survivalHp").isVisible(), false);
    console.log("PASS: 3-2-1-0 HP, game-over hiding, retry reset, normal-mode hiding, nonblocking overlay");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
