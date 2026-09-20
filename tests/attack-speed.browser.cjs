const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install();
    await page.goto(pathToFileURL(path.resolve(__dirname, "../peripheral-vision-trainer.html")).href);
    await page.locator("#ackSafetyBtn").click();
    await page.locator('[data-duration="30"]').click();
    await page.locator("#attackMoveBtn").click();
    assert.equal((await page.locator("label", { has: page.locator("#attackTiming") }).innerText()).trim(), "AS");
    await page.locator("#attackTiming").check();
    await page.locator("#attackPreset").selectOption("0.871");
    assert.match(await page.locator("#attackSpeedText").innerText(), /0.87/);
    await page.locator("#attackPreset").selectOption("2");
    await page.locator("#startBtn").click();
    await page.clock.pauseAt(new Date(Date.now() + 3000));
    assert.equal(await page.locator("#asReadiness").isVisible(), true);
    assert.match(await page.locator("#asReadinessLabel").innerText(), /READY/);
    const assertMoveGauge = async () => {
      const moveBox = await page.locator(".move-zone").boundingBox();
      const gaugeBox = await page.locator("#asReadiness").boundingBox();
      assert.ok(moveBox && gaugeBox);
      for (const key of ["x", "y", "width", "height"]) {
        assert.ok(Math.abs(moveBox[key] - gaugeBox[key]) < 1, "AS gauge tracks MOVE bounds");
      }
      assert.equal(await page.locator("#asReadiness").evaluate(el => getComputedStyle(el).pointerEvents), "none");
    };
    await assertMoveGauge();
    assert.equal(await page.locator("#asReadinessFill").evaluate(el => el.style.getPropertyValue("--progress")), "100%");
    const click = async (selector, button = "left") => {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button });
    };
    const shoot = async () => { await page.keyboard.press("a"); await click(".target"); };
    const move = () => click(".move-zone", "right");
    const score = async () => Number(await page.locator("#score").innerText());
    await move();
    await shoot();
    assert.equal(await score(), 0);
    assert.equal(await page.locator(".target.winding").count(), 1);
    assert.equal(await page.locator("#attackMoveCue").innerText(), "MOVE不可 / 発射待ち");
    assert.equal(await page.locator("#attackCue").getAttribute("data-phase"), "windup");
    assert.equal(await page.locator("#attackCue").evaluate(el => getComputedStyle(el).pointerEvents), "none");
    assert.equal(await page.locator(".aa-motion").evaluate(el => getComputedStyle(el).pointerEvents), "none");
    assert.equal(await page.locator(".aa-ring").evaluate(el => getComputedStyle(el).animationName), "aaWindup");
    await page.locator(".aa-ring").evaluate(el => {
      for (const animation of el.getAnimations()) { animation.pause(); animation.currentTime = 50; }
    });
    await page.screenshot({ path: path.resolve(__dirname, "../../../work/aa-windup.png") });
    await page.clock.runFor(50);
    await move();
    assert.equal(await page.locator(".aa-motion.cancelled .aa-label").innerText(), "MISS / CANCEL");
    await page.locator(".aa-motion.cancelled").evaluate(el => {
      for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 100; }
    });
    await page.screenshot({ path: path.resolve(__dirname, "../../../work/aa-cancel.png") });
    await page.clock.runFor(100);
    assert.equal(await score(), 0, "early MOVE cancels");
    assert.equal(await page.evaluate(() => state.movePositionUses), 0);
    await shoot();
    await page.clock.runFor(101);
    assert.equal(await score(), 0, "launch does not deal damage");
    assert.equal(await page.locator(".target-health").innerText(), "3 HP");
    assert.equal(await page.locator(".aa-projectile").count(), 1);
    assert.equal(await page.locator("#attackMoveCue").innerText(), "MOVE OK");
    assert.match(await page.locator("#attackReadyCue").innerText(), /次のAA/);
    const marker = await page.locator("#attackCue").boundingBox();
    const launch = await page.locator(".aa-projectile").evaluate(el => ({
      x: parseFloat(el.style.getPropertyValue("--x")), y: parseFloat(el.style.getPropertyValue("--y"))
    }));
    assert.ok(Math.abs(launch.x - marker.x - marker.width / 2) < 1);
    assert.ok(Math.abs(launch.y - marker.y - 8) < 1);
    await move();
    assert.equal(await page.locator(".aa-projectile").count(), 1, "MOVE cannot cancel a launched projectile");
    await page.locator(".aa-projectile").evaluate(el => {
      for (const animation of el.getAnimations()) { animation.pause(); animation.currentTime = 90; }
    });
    await page.screenshot({ path: path.resolve(__dirname, "../../../work/aa-flight.png") });
    await page.clock.runFor(180);
    assert.equal(await score(), 1);
    assert.equal(await page.locator(".aa-motion.fired").count(), 1);
    assert.equal(await page.locator(".target-health").innerText(), "2 HP");
    await move();
    await shoot();
    assert.equal(await page.locator(".target.winding").count(), 0, "queued attack waits before windup");
    assert.match(await page.locator("#sessionMeta").innerText(), /QUEUED/);
    assert.equal(await page.locator("#attackMoveCue").innerText(), "予約中 / MOVEで取消");
    assert.equal(await page.evaluate(() => state.attackMoved), false);
    await page.clock.runFor(17);
    assert.match(await page.locator("#asReadinessLabel").innerText(), /早押し/);
    assert.match(await page.locator("#asInputFeedback").innerText(), /早押し \d+ms/);
    await page.screenshot({ path: path.resolve(__dirname, "../../../work/as-readiness.png") });
    await assertMoveGauge();
    const progress = await page.locator("#asReadinessFill").evaluate(el => parseFloat(el.style.getPropertyValue("--progress")));
    assert.ok(progress > 0 && progress < 100);
    const fireAt = await page.evaluate(() => state.attackPending.fireAt);
    await shoot();
    await shoot();
    assert.equal(await page.evaluate(() => state.attackPending.fireAt), fireAt, "repeated clicks neither delay nor stack attacks");
    await page.clock.runFor(383);
    assert.equal(await score(), 1);
    await page.clock.runFor(101);
    assert.equal(await score(), 2);
    await move();
    await shoot();
    await move();
    await shoot();
    assert.match(await page.locator("#sessionMeta").innerText(), /QUEUED/, "canceling a queued attack preserves the previous cooldown");
    await page.clock.runFor(500);
    assert.equal(await score(), 3);
    assert.equal(await page.locator(".target").count(), 0);
    assert.equal(await page.locator(".move-zone").count(), 1);
    await page.clock.runFor(300);
    assert.equal(await page.locator(".target-health").innerText(), "3 HP");
    await move();
    await page.clock.runFor(17);
    await assertMoveGauge();
    await shoot();
    assert.equal(await page.locator(".target.winding").count(), 1);
    await page.clock.runFor(101);
    assert.equal(await page.locator(".aa-projectile").count(), 1);
    await page.keyboard.press("Escape");
    await page.clock.runFor(1000);
    assert.equal(await score(), 0, "exit cancels pending damage");
    assert.equal(await page.locator(".aa-motion").count(), 0, "exit removes AA visuals");
    assert.equal(await page.locator(".aa-projectile").count(), 0, "exit removes flying projectiles");
    assert.equal(await page.locator("#asReadiness").isVisible(), false);
    assert.equal(await page.locator("#attackCue").isVisible(), false);
    for (const speed of [0.65, 3]) {
      await page.locator("#attackSpeed").fill(String(speed));
      await page.locator("#startBtn").click();
      await page.clock.runFor(300);
      await move();
      await shoot();
      await page.clock.runFor(Math.floor(200 / speed) - 1);
      assert.equal(await score(), 0);
      await page.clock.runFor(3);
      assert.equal(await score(), 0, "windup ends before impact");
      await move();
      await page.clock.runFor(180);
      assert.equal(await score(), 1);
      await page.clock.runFor(Math.ceil(1000 / speed));
      assert.match(await page.locator("#asReadinessLabel").innerText(), /READY/);
      assert.match(await page.locator("#attackReadyCue").innerText(), /AA READY/);
      await shoot();
      await page.clock.runFor(17);
      assert.equal(await page.locator("#asInputFeedback").innerText(), "予約なし");
      await page.keyboard.press("Escape");
    }
    assert.deepEqual(errors, []);
    console.log("PASS: queued AS attacks, no stacking, cancellation preserves cooldown, 3HP, respawn, exit, speed adjustment.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
