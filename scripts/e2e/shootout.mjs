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
  // Hints and results are drawn in the canvas; the page mirrors the phase
  // and the result message on its screen-reader status line.
  const phase = () =>
    page.eval(
      `document.querySelector("[data-game-message]")?.dataset.phase ?? ""`,
    );
  const message = () =>
    page.eval(
      `document.querySelector("[data-game-message]")?.textContent ?? ""`,
    );
  const clickWorld = async (x, y) => {
    const r = await page.eval(
      `(() => { const r = document.querySelector("canvas").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`,
    );
    const cx = r.l + (x / 720) * r.w,
      cy = r.t + (y / 480) * r.h;
    for (const type of ["mousePressed", "mouseReleased"])
      await page.send("Input.dispatchMouseEvent", {
        type,
        x: cx,
        y: cy,
        button: "left",
        clickCount: 1,
      });
  };
  const resumeIfHidden = async () => {
    if ((await overlay()) === "Paused")
      await page.click("[role=dialog] button.btn-primary");
  };

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/nova-shootout");
  assert((await overlay()) === "Ready?", "start screen");
  assert(
    await page.eval(`!!document.querySelector('[aria-label="Goalie level"]')`),
    "goalie level picker",
  );
  await page.click('[aria-label="Goalie level"] button:nth-child(2)');
  assert(
    (await page.eval(
      `localStorage.getItem("rocketgame:nova-shootout:difficulty")`,
    )) === '"medium"',
    "level saved",
  );
  await page.click("[role=dialog] button.btn-primary");
  for (
    let i = 0;
    i < 50 && !(await page.eval(`!!document.querySelector("canvas")`));
    i++
  )
    await page.sleep(100);
  await page.sleep(1200); // let the smooth scroll-into-view finish
  for (let i = 0; i < 30 && (await phase()) !== "aim"; i++)
    await page.sleep(100);
  assert(
    (await phase()) === "aim",
    `aiming: ${await phase()} overlay=${await overlay()} hidden=${await page.eval("document.hidden")}`,
  );
  await page.screenshot("kick-aim");

  const messages = [];
  // Kick 1-3 with the mouse: aim at corners, stop the bar after a short wait.
  const aims = [
    [230, 170],
    [495, 280],
    [250, 285],
  ];
  const waitAim = async () => {
    for (let i = 0; i < 60 && (await phase()) !== "aim"; i++)
      await page.sleep(100);
  };
  for (const [x, y] of aims) {
    await resumeIfHidden();
    await waitAim();
    await clickWorld(x, y);
    await page.sleep(80);
    assert(
      (await phase()) === "power",
      `power bar running (${await phase()} overlay=${await overlay()} hidden=${await page.eval("document.hidden")})`,
    );
    await page.sleep(500); // power ≈ 0.6-0.7 on medium (1.45 s sweep)
    await clickWorld(360, 400);
    await page.sleep(1100);
    messages.push(await message());
    if (messages.length === 1) await page.screenshot("kick-result");
    await page.sleep(1300);
  }
  // Kick 4-5 with the keyboard: steer with arrows, Space twice.
  for (let k = 0; k < 2; k++) {
    await resumeIfHidden();
    await waitAim();
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowLeft",
      windowsVirtualKeyCode: 37,
    });
    await page.sleep(500);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowLeft",
      windowsVirtualKeyCode: 37,
    });
    await page.key(" ");
    await page.sleep(520);
    await page.key(" ");
    await page.sleep(1100);
    messages.push(await message());
    await page.sleep(1300);
  }
  console.log("  results:", messages.join(" | "));
  assert(
    messages.every((m) => /GOAL|So close/.test(m)),
    "each kick announces GOAL! or a friendly So close! message",
  );
  for (let i = 0; i < 30 && (await overlay()) === null; i++)
    await page.sleep(200);
  const over = await overlay();
  assert(
    /Champion|Nice shooting|Good try/.test(over ?? ""),
    `round over after 5 kicks: ${over}`,
  );
  const goals = Number(await stat("Goals"));
  assert((await stat("Kicks")) === "5/5", "5/5 kicks");
  const best = await page.eval(
    `localStorage.getItem("rocketgame:best:nova-shootout")`,
  );
  assert(
    goals === 0 ? best === null || best === "0" : Number(best) === goals,
    `best saved (${best}), goals ${goals}`,
  );
  await page.screenshot("kick-over");
  await page.click("[role=dialog] button.btn-primary");
  await page.sleep(400);
  assert(
    (await stat("Kicks")) === "0/5" && (await overlay()) === null,
    "Play again starts a new round",
  );
  if (page.errors.length) throw new Error("page had errors");
}
