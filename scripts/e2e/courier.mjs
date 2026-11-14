// Star Courier: start, controls, pause, game over, worlds, couriers, phone layout.
const BASE = process.env.BASE ?? "http://localhost:3123";
const WORLDS = ["moon-base", "mars-canyon", "ice-moon", "ring-station"];

export default async function scenario(page) {
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const phase = () =>
    page.eval(`document.querySelector("[data-phase]")?.dataset.phase ?? null`);
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const clickText = (text) =>
    page.eval(`(() => { const b = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().endsWith(${JSON.stringify(text)}));
      b?.click(); return !!b; })()`);
  const waitCanvas = async () => {
    for (
      let i = 0;
      i < 80 && !(await page.eval(`!!document.querySelector("canvas")`));
      i++
    )
      await page.sleep(100);
    await page.sleep(600);
  };
  const resumeIfPaused = async () => {
    if ((await overlay()) === "Paused" && (await page.eval("document.hidden")))
      await page.click("[role=dialog] button.btn-primary");
  };
  const fps = () =>
    page.eval(`new Promise((done) => { let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else done(n); };
      requestAnimationFrame(tick); })`);

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/star-courier");
  assert((await overlay()) === "Ready?", "start screen shows");
  assert(
    !(await page.eval(`!!document.querySelector("canvas")`)),
    "no Three.js before Start",
  );
  const threeLoaded = await page.eval(
    `performance.getEntriesByType("resource").some((r) => /three/i.test(r.name))`,
  );
  assert(!threeLoaded, "Three.js not downloaded before Start");
  assert(await clickText("Bix"), "courier picker has Bix");
  assert(await clickText("Ice Moon"), "world picker has Ice Moon");
  const pressed = await page.eval(
    `[...document.querySelectorAll("[aria-pressed=true]")].map((b) => b.textContent.trim())`,
  );
  assert(
    pressed.some((t) => t.endsWith("Bix")) && pressed.includes("Ice Moon"),
    `choices are remembered (${pressed.join(", ")})`,
  );

  await page.click("[role=dialog] button.btn-primary");
  await waitCanvas();
  assert(
    await page.eval(
      `!!document.querySelector("canvas")?.getContext("webgl2") || !!document.querySelector("canvas")?.getContext("webgl")`,
    ),
    "WebGL canvas after Start",
  );
  await resumeIfPaused();
  assert((await phase()) === "running", "run starts");
  const frames = await fps();
  console.log(`  frames per second in headless (software WebGL): ${frames}`);

  // Moves: none of these should scroll the page.
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
    await page.key(k);
    await page.sleep(250);
  }
  assert((await page.eval("window.scrollY")) === 0, "keys don't scroll");
  await page.screenshot("courier-ice-bix");

  await page.key("Escape");
  assert((await overlay()) === "Paused", "Esc pauses");
  const before = await page.eval(
    `document.querySelector("[data-phase]").closest("main")?.textContent.match(/(\\d[\\d,]*) m/)?.[1] ?? ""`,
  );
  await page.sleep(1200);
  const after = await page.eval(
    `document.querySelector("[data-phase]").closest("main")?.textContent.match(/(\\d[\\d,]*) m/)?.[1] ?? ""`,
  );
  assert(before === after, `distance holds while paused (${before} m)`);
  await page.key("Escape");
  assert((await overlay()) === null, "Esc resumes");
  await page.sleep(2500);
  await page.screenshot("courier-running");

  // Hands off: crates in the middle lane trip you up and Gloop catches you.
  const t0 = Date.now();
  while (
    (await overlay()) !== "Gooped! 🟢" &&
    (await overlay()) !== "Bonk! 💫"
  ) {
    // By Pod Park (about 2 minutes in) pods block the middle lane for sure.
    if (Date.now() - t0 > 180000) break;
    await resumeIfPaused();
    await page.sleep(250);
  }
  const title = await overlay();
  assert(
    title === "Gooped! 🟢" || title === "Bonk! 💫",
    `run ends without steering (${title}, ${Math.round((Date.now() - t0) / 1000)} s)`,
  );
  const best = await page.eval(
    `localStorage.getItem("rocketgame:best:star-courier")`,
  );
  assert(Number(best) > 0, `best score saved (${best})`);
  await page.screenshot("courier-over");

  // Each world draws.
  for (const w of WORLDS) {
    await page.eval(
      `localStorage.setItem("rocketgame:star-courier:world", ${JSON.stringify(JSON.stringify(w))})`,
    );
    await page.goto(BASE + "/games/star-courier");
    await page.click("[role=dialog] button.btn-primary");
    await waitCanvas();
    await resumeIfPaused();
    await page.sleep(1200);
    await page.screenshot(`courier-world-${w}`);
  }

  // Phone held upright: a tall board, swipes move.
  await page.viewport(390, 844, { mobile: true, dark: true });
  await page.goto(BASE + "/games/star-courier");
  const box = await page.eval(
    `(() => { const r = document.querySelector(".game-board").getBoundingClientRect(); return r.height / r.width; })()`,
  );
  assert(box > 1.2, `portrait board on a phone (h/w ${box.toFixed(2)})`);
  await page.tap("[role=dialog] button.btn-primary");
  await waitCanvas();
  await resumeIfPaused();
  await page.swipe(".game-board", -120, 0);
  await page.swipe(".game-board", 0, -120);
  await page.sleep(300);
  assert((await phase()) === "running", "swipes don't break the run");
  const sw = await page.eval("document.documentElement.scrollWidth");
  assert(sw <= 390, `no horizontal scroll at 390px (${sw})`);
  await page.screenshot("courier-phone");

  if (page.errors.length) throw new Error("page had errors");
}
