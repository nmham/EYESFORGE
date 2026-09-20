const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install();
    await page.goto(pathToFileURL(path.resolve(__dirname, "../peripheral-vision-trainer.html")).href);
    await page.locator("#ackSafetyBtn").click();
    await page.locator('[data-duration="30"]').click();
    await page.locator("#attackMoveBtn").click();
    await page.locator("#startBtn").click();
    const score = async () => Number(await page.locator("#score").innerText());
    const movePositions = [];
    const targetPositions = [];
    const move = async (button = "right") => {
      const zone = await page.locator(".move-zone").boundingBox();
      assert.ok(zone && zone.width >= 140);
      movePositions.push([zone.x, zone.y]);
      const targetBox = await page.locator(".target").boundingBox();
      targetPositions.push([targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2]);
      const distance = Math.hypot(zone.x + zone.width / 2 - targetBox.x - targetBox.width / 2,
        zone.y + zone.height / 2 - targetBox.y - targetBox.height / 2);
      assert.ok(distance > (zone.width + targetBox.width) / 2, "MOVE must not overlap the target");
      const fullTargetSize = await page.locator(".target").evaluate((element) => parseFloat(element.style.getPropertyValue("--size")));
      const gap = distance - (zone.width + fullTargetSize) / 2;
      assert.ok(gap > 80 && gap < 88, "MOVE keeps a moderate gap from the target");
      await page.mouse.click(zone.x + zone.width / 2, zone.y + zone.height / 2, { button });
      assert.equal(await page.locator(".move-zone").count(), 1);
      assert.equal(await page.locator(".move-zone").isVisible(), true);
      // Repeated MOVE clicks must not consume another use or move the zone early.
      await page.mouse.click(zone.x + zone.width / 2, zone.y + zone.height / 2, { button });
    };
    const target = {
      async click(options = {}) {
        await page.locator(".target").waitFor({ state: "visible" });
        const box = await page.locator(".target").boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, options);
      },
      boundingBox: () => page.locator(".target").boundingBox(),
    };
    await target.click();
    await target.click({ button: "right" });
    assert.equal(await score(), 0);
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 0);
    await page.locator("#cursorPanelBtn").click();
    await page.locator("#cursorPanelClose").click();
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 0);
    await page.mouse.click(8, 8, { button: "right" });
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 0);
    const moveBox = await page.locator(".move-zone").boundingBox();
    await page.mouse.click(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2);
    assert.equal(await page.locator(".move-zone").count(), 1);
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 0);
    assert.equal(await page.locator("#accuracy").innerText(), "100%");
    await move("right");
    await target.click();
    assert.equal(await score(), 0);
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 1);
    assert.equal(await page.locator(".target-health").textContent(), "2 HP");
    await page.clock.runFor(400);
    await target.click();
    assert.equal(await score(), 1);
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 1);
    await move();
    await page.keyboard.press("a");
    await target.click({ button: "right" });
    await target.click();
    assert.equal(await score(), 1);
    await page.keyboard.down("a");
    await target.click();
    assert.equal(await score(), 2);
    assert.equal(await page.locator(".target-health").textContent(), "1 HP");
    await page.clock.runFor(400);
    await move();
    await page.keyboard.down("a");
    await target.click();
    assert.equal(await score(), 2);
    await page.keyboard.up("a");
    await page.keyboard.press("a");
    await page.mouse.click(8, 8);
    assert.equal(await page.locator("#accuracy").innerText(), "100%");
    await page.clock.runFor(400);
    await target.click();
    assert.equal(await score(), 2);
    await page.keyboard.press("a");
    // Clicking outside the orange target never destroys it.
    const box = await target.boundingBox();
    await page.mouse.click(box.x + box.width * 1.1, box.y + box.height / 2);
    assert.equal(await score(), 2);
    await page.keyboard.press("a");
    await target.click();
    assert.equal(await score(), 3);
    for (let hit = 4; hit <= 9; hit++) {
      await page.clock.runFor(400);
      await move();
      await page.keyboard.press("a");
      await target.click();
      assert.equal(await score(), hit);
      assert.equal(await page.locator(".move-zone").isVisible(), true);
      assert.equal(await page.locator(".target").count(), hit % 3 === 0 ? 0 : 1);
      if (hit % 3 !== 0) assert.equal(await page.locator(".target-health").textContent(), (3 - hit % 3) + " HP");
      const zone = await page.locator(".move-zone").boundingBox();
      // Clicking during the target respawn gap must not count toward the next cycle.
      if (hit % 3 === 0) await page.mouse.click(zone.x + zone.width / 2, zone.y + zone.height / 2, { button: "right" });
    }
    for (let group = 0; group < 9; group += 3) {
      assert.deepEqual(movePositions[group], movePositions[group + 1]);
      assert.deepEqual(movePositions[group], movePositions[group + 2]);
      for (const index of [group + 1, group + 2]) {
        assert.ok(Math.hypot(targetPositions[group][0] - targetPositions[index][0],
          targetPositions[group][1] - targetPositions[index][1]) < 1, "Target stays in place until its third hit");
      }
      if (group) assert.notDeepEqual(movePositions[group], movePositions[group - 1]);
    }
    await page.clock.runFor(30_000);
    assert.equal(await page.locator("#results").isVisible(), true);
    assert.equal(await page.locator(".move-zone").count(), 0);
    const rankings = await page.evaluate(() => JSON.parse(localStorage.getItem("peripheralVisionTrainer.rankings.v1")));
    assert.equal(rankings["attack-move-static-30"][0].score, 9);
    await page.locator("#menuBtn").click();
    await page.locator("#attackMoveBtn").click();
    await page.locator("#startBtn").click();
    await target.click({ button: "right" });
    assert.equal(await score(), 1);
    assert.equal(await page.locator(".move-zone").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: right-click-only MOVE, left-click ignored, MOVE required per hit, A required, cleanup, ranking, normal right-click");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
