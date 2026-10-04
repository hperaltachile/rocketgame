const BASE = process.env.BASE ?? "http://localhost:3123";

export default async function scenario(page) {
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const labels = (sel) =>
    page.eval(
      `[...document.querySelectorAll(${JSON.stringify(sel)})].map(b => b.getAttribute("aria-label"))`,
    );
  const stat = (label) =>
    page.eval(
      `[...document.querySelectorAll("dl > div")].find(d => d.querySelector("dt").textContent === ${JSON.stringify(label)})?.querySelector("dd").textContent`,
    );
  const rightClick = async (selector) => {
    const b = await page.eval(
      `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
    for (const type of ["mousePressed", "mouseReleased"]) {
      await page.send("Input.dispatchMouseEvent", {
        type,
        x: b.x,
        y: b.y,
        button: "right",
        clickCount: 1,
      });
    }
    await page.sleep(100);
  };

  await page.viewport(1280, 900);

  // ---------- Minesweeper ----------
  console.log("# Minesweeper");
  await page.goto(BASE + "/games/minesweeper");
  assert((await overlay()) === "Ready?", "start screen");
  await page.click("[role=dialog] button.btn-primary");
  const cells = () => labels("[role=grid] button");
  assert((await cells()).length === 81, "81 cells");
  await page.click(
    "[role=grid] [role=row]:nth-child(5) [role=gridcell]:nth-child(5) button",
  );
  let opened = (await cells()).filter((l) => !l.endsWith("hidden")).length;
  assert(
    opened > 1 && (await overlay()) === null,
    `first click is safe and opens an area (${opened} cells)`,
  );
  await page.sleep(2100);
  assert((await stat("Time")) !== "0s", `timer runs (${await stat("Time")})`);

  const hiddenIdx = async () =>
    (await cells())
      .map((l, i) => (l.endsWith("hidden") ? i : -1))
      .filter((i) => i >= 0);
  const sel = (i) =>
    `[role=grid] [role=row]:nth-child(${Math.floor(i / 9) + 1}) [role=gridcell]:nth-child(${(i % 9) + 1}) button`;
  let h = await hiddenIdx();
  await rightClick(sel(h[0]));
  assert(
    (await cells())[h[0]].endsWith("flagged") &&
      (await stat("Mines left")) === "9",
    "right-click places a flag (mines left 9)",
  );
  await page.click("button[aria-pressed]");
  await page.click(sel(h[1]));
  assert(
    (await cells())[h[1]].endsWith("flagged"),
    "Flag mode + tap places a flag",
  );
  await page.click("button[aria-pressed]");
  // Keyboard: F toggles a flag on the focused cell.
  await page.eval(
    `document.querySelectorAll("[role=grid] button")[${h[2]}].focus()`,
  );
  await page.key("f");
  assert(
    (await cells())[h[2]].endsWith("flagged"),
    "F key flags the focused cell",
  );
  await page.key("ArrowRight");
  const focusedIdx = await page.eval(
    `[...document.querySelectorAll("[role=grid] button")].indexOf(document.activeElement)`,
  );
  assert(
    focusedIdx === (h[2] % 9 === 8 ? h[2] : h[2] + 1),
    "arrow keys move focus between cells",
  );

  // Open hidden, unflagged cells until something happens (usually a mine).
  let guard = 0;
  while ((await overlay()) === null && guard++ < 81) {
    const hidden = await hiddenIdx();
    if (!hidden.length) break;
    await page.click(sel(hidden[Math.floor(hidden.length / 2)]));
  }
  const msOver = await overlay();
  assert(
    msOver === "Boom! 💥" || msOver === "Field cleared! 🎉",
    `game ends (${msOver})`,
  );
  await page.screenshot("mines-over");
  await page.click("[role=dialog] button.btn-primary");
  assert(
    (await hiddenIdx()).length === 81 && (await stat("Time")) === "0s",
    "Play again gives a fresh board",
  );

  // ---------- Tic-Tac-Toe ----------
  console.log("# Tic-Tac-Toe");
  await page.goto(BASE + "/games/tictactoe");
  assert(
    await page.eval(
      `document.querySelector('[aria-label="Difficulty"] [aria-pressed="true"]').textContent === "Easy"`,
    ),
    "Easy is the default",
  );
  await page.click("[role=dialog] button.btn-primary");
  const ttt = () => labels("[role=grid] button");
  const playFirstEmpty = async () => {
    const i = (await ttt()).findIndex((l) => l.endsWith("empty"));
    await page.click(
      `[role=grid] [role=row]:nth-child(${Math.floor(i / 3) + 1}) [role=gridcell]:nth-child(${(i % 3) + 1}) button`,
    );
  };
  const playGame = async () => {
    for (let turn = 0; turn < 6 && (await overlay()) === null; turn++) {
      await playFirstEmpty();
      await page.sleep(700);
    }
    return overlay();
  };
  // Keyboard move first.
  await page.eval(`document.querySelector("[role=grid] button").focus()`);
  await page.key("ArrowRight");
  await page.key("ArrowDown");
  await page.key("Enter");
  assert((await ttt())[4].endsWith("X"), "arrow keys + Enter play the centre");
  await page.sleep(700);
  assert(
    (await ttt()).filter((l) => l.endsWith("O")).length === 1,
    "computer answers",
  );
  const easyResult = await playGame();
  assert(
    ["You win! 🎉", "It's a draw 🤝", "The computer wins 🤖"].includes(
      easyResult,
    ),
    `Easy game ends (${easyResult})`,
  );
  const tally1 = await page.eval(
    `JSON.parse(localStorage.getItem("rocketgame:tictactoe:tally"))`,
  );
  assert(
    tally1.wins + tally1.draws + tally1.losses === 1,
    `tally saved ${JSON.stringify(tally1)}`,
  );

  await page.click("[role=dialog] button.btn-primary");
  await page.click('[aria-label="Difficulty"] button:nth-child(2)');
  assert(
    await page.eval(
      `document.querySelector('[aria-label="Difficulty"] [aria-pressed="true"]').textContent === "Hard"`,
    ),
    "switch to Hard",
  );
  for (let g = 0; g < 3; g++) {
    const r = await playGame();
    assert(r !== "You win! 🎉", `Hard never loses (game ${g + 1}: ${r})`);
    await page.click("[role=dialog] button.btn-primary");
  }
  await page.screenshot("ttt");

  // ---------- Memory Match ----------
  console.log("# Memory Match");
  await page.goto(BASE + "/games/memory");
  await page.click("[role=dialog] button.btn-primary");
  const cards = () => labels("[role=grid] button");
  const cardSel = (i) =>
    `[role=grid] [role=row]:nth-child(${Math.floor(i / 4) + 1}) [role=gridcell]:nth-child(${(i % 4) + 1}) button`;
  const nameOf = async (i) =>
    (await cards())[i].replace(/^Card \d+: /, "").replace(", matched", "");
  assert(
    (await cards()).every((l) => l.endsWith("face down")),
    "16 face-down cards",
  );

  // A bot with perfect memory.
  const seen = new Map();
  const known = new Map();
  let safety = 0;
  while ((await overlay()) === null && safety++ < 60) {
    const labs = await cards();
    const down = labs
      .map((l, i) => (l.endsWith("face down") ? i : -1))
      .filter((i) => i >= 0);
    let pair = null;
    for (const [, idxs] of known) {
      const live = idxs.filter((i) => down.includes(i));
      if (live.length === 2) pair = live;
    }
    let a, b;
    if (pair) [a, b] = pair;
    else {
      a = down.find((i) => !seen.has(i));
      await page.click(cardSel(a));
      const na = await nameOf(a);
      seen.set(a, na);
      known.set(na, [...(known.get(na) ?? []), a]);
      const partner = (known.get(na) ?? []).find(
        (i) => i !== a && down.includes(i),
      );
      b = partner ?? down.find((i) => i !== a && !seen.has(i));
      await page.click(cardSel(b));
      const nb = await nameOf(b);
      seen.set(b, nb);
      if (!known.get(nb)?.includes(b))
        known.set(nb, [...(known.get(nb) ?? []), b]);
      await page.sleep(1000);
      continue;
    }
    await page.click(cardSel(a));
    await page.click(cardSel(b));
    await page.sleep(400);
  }
  assert((await overlay()) === "All pairs found! 🎉", "bot finds all pairs");
  const moves = Number(await stat("Moves"));
  const best = Number(
    await page.eval(`localStorage.getItem("rocketgame:best:memory")`),
  );
  assert(moves >= 8 && best === moves, `fewest moves saved (${best})`);
  await page.screenshot("memory-over");

  // ---------- Mobile layout for all three ----------
  await page.viewport(375, 800, { mobile: true, dark: true });
  for (const slug of ["minesweeper", "tictactoe", "memory"]) {
    await page.goto(`${BASE}/games/${slug}`);
    await page.click("[role=dialog] button.btn-primary");
    const sw = await page.eval("document.documentElement.scrollWidth");
    assert(sw <= 375, `${slug}: no horizontal scroll at 375px (${sw})`);
    await page.screenshot(`${slug}-mobile`, true);
  }

  // Home: every card is playable now.
  await page.goto(BASE + "/");
  assert(
    !(await page.eval(`document.body.textContent.includes("Coming soon")`)),
    "no 'Coming soon' left on the home page",
  );

  if (page.errors.length) throw new Error("page had errors");
}
