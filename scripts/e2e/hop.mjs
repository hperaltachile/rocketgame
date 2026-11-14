// Astro Hop: start, intro card, run and jump, pause, world picker, and a
// look at every kind of level (caves, sky, both fortresses with Big Clank).
const BASE = process.env.BASE ?? "http://localhost:3123";

export default async function scenario(page) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const phase = () =>
    page.eval(`document.querySelector("[data-game-message]").dataset.phase`);
  const stat = (name) =>
    page.eval(
      `document.querySelector("[data-game-message]").dataset[${JSON.stringify(name.toLowerCase())}]`,
    );
  const KEY_CODES = { ArrowRight: 39, ArrowLeft: 37, Space: 32, ShiftLeft: 16 };
  const hold = (code, down) =>
    page.send("Input.dispatchKeyEvent", {
      type: down ? "keyDown" : "keyUp",
      code,
      key: code === "Space" ? " " : code.replace("Left", ""),
      windowsVirtualKeyCode: KEY_CODES[code],
    });
  const resumeIfHidden = async () => {
    if ((await overlay()) === "Paused") await page.key("p");
  };
  const waitFor = async (check, ms = 8000) => {
    for (let t = 0; t < ms; t += 100) {
      if (await check()) return true;
      await page.sleep(100);
      await resumeIfHidden();
    }
    return false;
  };

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/astro-hop");
  await page.eval(`localStorage.removeItem("rocketgame:astro-hop:unlocked");
    localStorage.removeItem("rocketgame:astro-hop:start")`);
  await page.goto(BASE + "/games/astro-hop");
  assert((await overlay()) === "Ready?", "start screen shows");
  assert(
    await page.eval(
      `(() => {
        const locked = [...document.querySelectorAll("[aria-label='Start at world'] button")].map(b => b.disabled);
        return locked.length === 8 && !locked[0] && locked.slice(1).every(Boolean);
      })()`,
    ),
    "only World 1-1 is unlocked at first",
  );
  await page.screenshot("hop-ready");

  await page.click("[role=dialog] button.btn-primary");
  assert(
    await waitFor(() => page.eval(`!!document.querySelector("canvas")`)),
    "Start loads Phaser",
  );
  await page.send("Page.bringToFront");
  assert(await waitFor(async () => (await phase()) === "intro"), "intro card");
  await page.screenshot("hop-intro");
  assert(
    await waitFor(async () => (await phase()) === "play"),
    "the level starts after the intro",
  );
  await page.screenshot("hop-start");

  const time0 = Number(await stat("Time"));
  await hold("ArrowRight", true);
  await page.sleep(700);
  await hold("Space", true);
  await page.sleep(350);
  await page.screenshot("hop-jump");
  await hold("Space", false);
  await page.sleep(900);
  await hold("ArrowRight", false);
  await page.screenshot("hop-run");
  assert(Number(await stat("Time")) < time0, "the level clock counts down");
  assert(
    (await page.eval("window.scrollY")) === 0,
    "arrows and Space don't scroll the page",
  );

  await page.key("p");
  assert((await overlay()) === "Paused", "P pauses");
  const t = await stat("Time");
  await page.sleep(1200);
  assert((await stat("Time")) === t, "clock frozen while paused");
  await page.key("p");
  assert((await overlay()) === null, "P resumes");

  // Walk right into the first Grumble: small Kit loses a life.
  await hold("ArrowRight", true);
  const lost = await waitFor(
    async () => Number(await stat("Lives")) < 3,
    15000,
  );
  await hold("ArrowRight", false);
  console.log(`  phase: ${await phase()}, lives: ${await stat("Lives")}`);
  assert(lost || (await phase()) === "dying", "touching an enemy costs a life");

  // The other worlds (unlock them as if reached).
  for (const [index, id] of [
    [1, "1-2"],
    [2, "1-3"],
    [3, "1-4"],
    [5, "2-2"],
    [7, "2-4"],
  ]) {
    await page.eval(`localStorage.setItem("rocketgame:astro-hop:unlocked", "7");
      localStorage.setItem("rocketgame:astro-hop:start", "${index}")`);
    await page.goto(BASE + "/games/astro-hop");
    assert((await stat("World")) === id, `World ${id} can be picked`);
    await page.click("[role=dialog] button.btn-primary");
    await page.send("Page.bringToFront");
    assert(
      await waitFor(async () => (await phase()) === "play"),
      `${id} starts`,
    );
    await page.sleep(300);
    await page.screenshot(`hop-${id}`);
    await hold("ArrowRight", true);
    await page.sleep(1500);
    await hold("ArrowRight", false);
    await page.screenshot(`hop-${id}-run`);
    if (id.endsWith("-4")) {
      assert((await stat("Boss")) === "sleep", `${id} has Big Clank, asleep`);
    }
  }
}

// Not part of the default run: hop through 1-1 to see the beacon and rocket.
export async function toTheBeacon(page) {
  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/astro-hop");
  await page.eval(`localStorage.setItem("rocketgame:astro-hop:start", "0")`);
  await page.goto(BASE + "/games/astro-hop");
  await page.click("[role=dialog] button.btn-primary");
  await page.send("Page.bringToFront");
  await page.sleep(3000);
  const key = (code, down) =>
    page.send("Input.dispatchKeyEvent", {
      type: down ? "keyDown" : "keyUp",
      code,
      key: code === "Space" ? " " : "ArrowRight",
      windowsVirtualKeyCode: code === "Space" ? 32 : 39,
    });
  await key("ArrowRight", true);
  for (let i = 0; i < 80; i++) {
    await key("Space", true);
    await page.sleep(450);
    await key("Space", false);
    await page.sleep(150);
    const phase = await page.eval(
      `document.querySelector("[data-game-message]").dataset.phase`,
    );
    if (phase === "goal") break;
    if (
      (await page.eval(
        `document.querySelector("[role=dialog] h2")?.textContent`,
      )) === "Paused"
    )
      await page.key("p");
  }
  await key("ArrowRight", false);
  for (let i = 0; i < 6; i++) {
    await page.screenshot(`hop-goal-${i}`);
    await page.sleep(700);
  }
}
