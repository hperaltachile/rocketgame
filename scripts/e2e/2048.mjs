const URL = process.env.URL ?? "http://localhost:3123/games/2048";

export default async function scenario(page) {
  const grid = () =>
    page.eval(
      `[...document.querySelectorAll("table.sr-only td")].map(td => td.textContent).join(",")`,
    );
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };

  // Desktop, light mode
  await page.viewport(1280, 900);
  await page.goto(URL);
  assert((await overlay()) === "Ready?", "start screen shows");
  await page.screenshot("2048-start");
  await page.click("[role=dialog] button.btn-primary");
  assert((await overlay()) === null, "Start begins the game");
  const g0 = await grid();
  assert(
    g0.split(",").filter((v) => v !== "empty").length === 2,
    "two starting tiles",
  );

  await page.eval("window.scrollTo(0, 0)");
  let changed = 0;
  for (const k of [
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
    "a",
    "w",
    "d",
    "s",
  ]) {
    const before = await grid();
    await page.key(k);
    await page.sleep(150);
    if ((await grid()) !== before) changed++;
  }
  assert(
    changed >= 4,
    `arrow keys / WASD move tiles (${changed}/8 changed the board)`,
  );
  assert(
    (await page.eval("window.scrollY")) === 0,
    "arrow keys and Space don't scroll the page",
  );
  await page.key(" ");
  assert(
    (await page.eval("window.scrollY")) === 0,
    "Space doesn't scroll the page mid-game",
  );
  await page.screenshot("2048-playing");

  await page.key("p");
  assert((await overlay()) === "Paused", "P pauses");
  const pausedGrid = await grid();
  await page.key("ArrowLeft");
  await page.key("ArrowUp");
  assert((await grid()) === pausedGrid, "no moves while paused");
  await page.key("Escape");
  assert((await overlay()) === null, "Esc resumes");

  await page.eval(`Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"))`);
  await page.sleep(100);
  assert((await overlay()) === "Paused", "auto-pauses when the tab is hidden");
  await page.eval(`delete document.hidden`);
  await page.click("[role=dialog] button.btn-primary");
  assert((await overlay()) === null, "Resume button resumes");

  const before = await grid();
  await page.click('button[aria-label="Go left"]');
  await page.click('button[aria-label="Go up"]');
  await page.click('button[aria-label="Go right"]');
  assert((await grid()) !== before, "on-screen arrow buttons move tiles");

  // Play until game over (cycle keeps it moving; fall back when stuck).
  const cycle = [
    "ArrowDown",
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    "ArrowUp",
  ];
  let moves = 0;
  let hiddenPauses = 0;
  for (;;) {
    const ov = await overlay();
    if (ov === "Paused" && (await page.eval("document.hidden"))) {
      // Headless Edge occasionally reports itself hidden; auto-pause is correct.
      hiddenPauses++;
      await page.key("p");
      continue;
    }
    if (ov !== null || moves >= 3000 || hiddenPauses > 20) break;
    await page.key(cycle[moves % cycle.length]);
    moves++;
  }
  if (hiddenPauses)
    console.log(
      `note - headless tab went hidden ${hiddenPauses}x and auto-paused`,
    );
  const ov = await overlay();
  console.log(
    "visibility:",
    await page.eval(
      "document.visibilityState + ' hidden=' + document.hidden + ' own=' + Object.getOwnPropertyNames(document).join()",
    ),
  );
  assert(
    ov === "No more moves",
    `game over screen after ${moves} key presses (overlay: ${JSON.stringify(ov)}, grid: ${await grid()})`,
  );
  const score = await page.eval(`document.querySelector("dd")?.textContent`);
  const best = await page.eval(`localStorage.getItem("rocketgame:best:2048")`);
  assert(
    best !== null && Number(best) === Number(score.replace(/,/g, "")),
    `best score saved (${best}) equals score (${score})`,
  );
  assert(
    await page.eval(`document.body.textContent.includes("New best!")`),
    "shows New best!",
  );
  await page.screenshot("2048-over");

  await page.click("[role=dialog] button.btn-primary");
  assert((await overlay()) === null, "Play again restarts");
  assert(
    (await page.eval(`document.querySelector("dd")?.textContent`)) === "0",
    "score resets to 0",
  );

  // Home page card shows the best score
  await page.goto(URL.replace("/games/2048", "/"));
  assert(
    await page.eval(
      `[...document.querySelectorAll("a[href='/games/2048']")].some(a => a.textContent.includes("${Number(best).toLocaleString("en-US")}"))`,
    ),
    "home page card shows the best score",
  );

  // Mobile, dark mode, swipes
  await page.viewport(375, 760, { mobile: true, dark: true });
  await page.goto(URL);
  await page.click("[role=dialog] button.btn-primary");
  let swiped = 0;
  for (const [dx, dy] of [
    [-120, 0],
    [0, -120],
    [120, 0],
    [0, 120],
  ]) {
    const b = await grid();
    await page.swipe(".touch-none", dx, dy);
    if ((await grid()) !== b) swiped++;
  }
  assert(swiped >= 2, `swipes move tiles (${swiped}/4 changed the board)`);
  const sw = await page.eval("document.documentElement.scrollWidth");
  assert(sw <= 375, `no horizontal scroll at 375px (scrollWidth ${sw})`);
  await page.screenshot("2048-mobile-dark", true);

  if (page.errors.length) throw new Error("page had errors");
}
