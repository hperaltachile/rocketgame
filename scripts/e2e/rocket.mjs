const BASE = process.env.BASE ?? "http://localhost:3123";

export default async function scenario(page) {
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const score = () =>
    page.eval(
      `Number(document.querySelector("dd").textContent.replace(/,/g, ""))`,
    );
  const jsKB = () =>
    page.eval(
      `Math.round(performance.getEntriesByType("resource").filter(r => r.name.endsWith(".js")).reduce((s, r) => s + r.transferSize, 0) / 1024)`,
    );
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const resumeIfHidden = async () => {
    if ((await overlay()) === "Paused" && (await page.eval("document.hidden")))
      await page.key("p");
  };

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/rocket-run");
  assert((await overlay()) === "Ready?", "start screen shows");
  assert(
    !(await page.eval(`!!document.querySelector("canvas")`)),
    "no canvas before Start",
  );
  const before = await jsKB();
  console.log(`  JS transferred before Start: ${before} KB`);

  await page.click("[role=dialog] button.btn-primary");
  for (
    let i = 0;
    i < 50 && !(await page.eval(`!!document.querySelector("canvas")`));
    i++
  )
    await page.sleep(100);
  assert(
    await page.eval(`!!document.querySelector("canvas")`),
    "Start loads Phaser and creates the canvas",
  );
  const after = await jsKB();
  assert(
    after - before > 150,
    `Phaser downloaded only after Start (+${after - before} KB)`,
  );

  // Keep the rocket alive for a bit by boosting, measure frame rate meanwhile.
  await page.eval(
    `window.__frames = 0; (function f(){ window.__frames++; requestAnimationFrame(f); })()`,
  );
  const t0 = Date.now();
  for (let i = 0; i < 12; i++) {
    await page.key(" ");
    await page.sleep(160);
    await resumeIfHidden();
  }
  const fps = Math.round(
    (await page.eval("window.__frames")) / ((Date.now() - t0) / 1000),
  );
  console.log(`  frame rate (headless, software rendering): ~${fps} fps`);
  const s1 = await score();
  assert(s1 > 0, `score goes up while flying (${s1})`);
  await page.screenshot("rocket-playing");
  assert(
    (await page.eval("window.scrollY")) === 0,
    "Space doesn't scroll the page",
  );

  await page.key("p");
  assert((await overlay()) === "Paused", "P pauses");
  const sp = await score();
  await page.sleep(800);
  assert((await score()) === sp, "score frozen while paused");
  await page.key("p");
  assert((await overlay()) === null, "P resumes");

  // Stop boosting: the rocket falls and sooner or later meets an asteroid.
  let waited = 0;
  while ((await overlay()) !== "Crash!" && waited < 90000) {
    await page.sleep(500);
    waited += 500;
    if (waited % 10000 === 0)
      console.log(
        `  t=${waited / 1000}s score=${await score()} hidden=${await page.eval("document.hidden")}`,
      );
    await resumeIfHidden();
  }
  assert(
    (await overlay()) === "Crash!",
    `crashes into an asteroid (after ${waited / 1000}s)`,
  );
  const final = await score();
  const best = await page.eval(
    `localStorage.getItem("rocketgame:best:rocket-run")`,
  );
  assert(Number(best) === final && final > 0, `best score saved (${best})`);
  await page.screenshot("rocket-over");

  await page.click("[role=dialog] button.btn-primary");
  await page.sleep(300);
  assert(
    (await overlay()) === null && (await score()) < 5,
    "Play again restarts from 0",
  );

  // Leaving the page destroys the game (client-side navigation).
  await page.click('a[href="/#games"]');
  await page.sleep(800);
  assert(
    !(await page.eval(`!!document.querySelector("canvas")`)),
    "canvas removed after leaving the page",
  );

  // Mobile: tap to boost, no horizontal scroll.
  await page.viewport(375, 760, { mobile: true, dark: true });
  await page.goto(BASE + "/games/rocket-run");
  await page.click("[role=dialog] button.btn-primary");
  for (
    let i = 0;
    i < 50 && !(await page.eval(`!!document.querySelector("canvas")`));
    i++
  )
    await page.sleep(100);
  await page.sleep(500);
  const y0 = await page.eval(
    `(() => { const c = document.querySelector("canvas").getBoundingClientRect(); return c.width; })()`,
  );
  assert(
    y0 > 300 && y0 <= 375,
    `canvas fits the phone width (${Math.round(y0)} px)`,
  );
  const sw = await page.eval("document.documentElement.scrollWidth");
  assert(sw <= 375, `no horizontal scroll at 375px (${sw})`);
  await page.swipe("canvas", 0, 0);
  await page.screenshot("rocket-mobile");

  if (page.errors.length) throw new Error("page had errors");
}
