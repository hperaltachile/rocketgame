const BASE = process.env.BASE ?? "http://localhost:3123";
export default async function scenario(page) {
  const assert = (c, m) => {
    if (!c) throw new Error(m);
    console.log("ok -", m);
  };
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const stat = (label) =>
    page.eval(
      `[...document.querySelectorAll("dl > div")].find(d => d.querySelector("dt").textContent === ${JSON.stringify(label)})?.querySelector("dd").textContent`,
    );
  const statAria = (label) =>
    page.eval(
      `[...document.querySelectorAll("dl > div")].find(d => d.querySelector("dt").textContent === ${JSON.stringify(label)})?.querySelector("dd [aria-label]").getAttribute("aria-label")`,
    );
  const callout = () =>
    page.eval(
      `document.querySelector(".game-board > div.pointer-events-none")?.textContent ?? ""`,
    );

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/star-slugger");
  assert((await overlay()) === "Ready?", "start screen");
  await page.click("[role=dialog] button.btn-primary");
  for (
    let i = 0;
    i < 50 && !(await page.eval(`!!document.querySelector("canvas")`));
    i++
  )
    await page.sleep(100);

  // Timed swings: watch for the pitch label to disappear (= release), then
  // press Space when the ball should reach the plate.
  await page.eval(`(() => {
    const TRAVEL = { "🐢 Slow pitch": 1500, "Medium pitch": 1150, "⚡ Fast pitch!": 850 };
    window.__swings = [];
    let label = null;
    const el = () => document.querySelector(".game-board > div.pointer-events-none");
    new MutationObserver(() => {
      const text = el()?.textContent ?? "";
      if (TRAVEL[text]) { label = text; return; }
      if (label && text === "" && window.__autoSwing > 0) {
        const travel = TRAVEL[label]; label = null; window.__autoSwing--;
        setTimeout(() => { window.__swings.push(travel); window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })); }, travel - 12);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  })()`);
  await page.eval("window.__autoSwing = 3");
  const seen = [];
  for (let i = 0; i < 400 && seen.length < 3; i++) {
    const c = await callout();
    if (
      /HOME RUN|Nice hit|Foul|Strike/.test(c) &&
      seen.at(-1) !== c + seen.length
    ) {
      seen.push(c);
      if (seen.length === 1) await page.screenshot("slugger-result");
      while (/HOME RUN|Nice hit|Foul|Strike/.test(await callout()))
        await page.sleep(50);
    }
    await page.sleep(25);
  }
  console.log(
    "  timed swings:",
    seen.join(" | "),
    "pitches:",
    await page.eval("JSON.stringify(window.__swings)"),
  );
  const hits = Number(await stat("Hits")) + Number(await stat("Home runs"));
  assert(hits >= 2, `well-timed swings make hits/home runs (${hits} of 3)`);
  const score = Number(await stat("Score"));
  assert(
    score === Number(await stat("Hits")) + 4 * Number(await stat("Home runs")),
    `score = hits + 4 × home runs (${score})`,
  );

  const framesPerSecond = () =>
    page.eval(
      `new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); })(); })`,
    );

  // Now stop swinging: 9 strikes → 3 outs → game over.
  await page.screenshot("slugger-windup");
  let waited = 0;
  while ((await overlay()) !== "Three outs! ⚾" && waited < 90000) {
    await page.sleep(500);
    waited += 500;
    // Headless Edge sometimes throttles a visible, focused tab to ~3 frames/s
    // (the game is fine, just in slow motion). Bringing it to the front and
    // forcing a frame restores 60 fps.
    if (waited % 5000 === 0 && (await framesPerSecond()) < 10) {
      await page.send("Page.bringToFront");
      await page.screenshot("slugger-unthrottle");
      console.log(
        `  (browser throttled frames; restored to ${await framesPerSecond()} fps)`,
      );
    }
    if ((await overlay()) === "Paused")
      await page.click("[role=dialog] button.btn-primary");
  }
  assert(
    (await overlay()) === "Three outs! ⚾",
    `no swings: 3 outs end the game (${waited / 1000}s)`,
  );
  assert((await statAria("Outs")) === "3 outs", "outs counter shows 3");
  const best = await page.eval(
    `localStorage.getItem("rocketgame:best:star-slugger")`,
  );
  assert(Number(best) === score, `best saved (${best})`);
  await page.screenshot("slugger-over");

  // Play again, and a swing via click on the canvas.
  await page.click("[role=dialog] button.btn-primary");
  await page.sleep(400);
  assert(
    (await stat("Score")) === "0" && (await overlay()) === null,
    "Play again starts over",
  );
  if (page.errors.length) throw new Error("page had errors");
}
