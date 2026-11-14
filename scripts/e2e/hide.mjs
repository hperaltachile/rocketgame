// Hide & Seek: Mazes: house picker, start, countdown, walk to a spot, hide and exit, pause freezes the timer, restart resets.
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
  const data = (name) =>
    page.eval(
      `document.querySelector("[data-game-message]").dataset[${JSON.stringify(name)}]`,
    );
  const KEY_CODES = { ArrowLeft: 37, ArrowRight: 39, KeyE: 69 };
  const hold = (code, down) =>
    page.send("Input.dispatchKeyEvent", {
      type: down ? "keyDown" : "keyUp",
      code,
      key: code === "KeyE" ? "e" : code,
      windowsVirtualKeyCode: KEY_CODES[code],
    });
  const press = async (code) => {
    await hold(code, true);
    await page.sleep(60);
    await hold(code, false);
  };
  const resumeIfHidden = async () => {
    if ((await overlay()) === "Paused")
      await page.click("[role=dialog] button.btn-primary");
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
  await page.goto(BASE + "/games/hide-and-seek");
  assert((await overlay()) === "Ready?", "start screen shows");
  const houses = await page.eval(
    `[...document.querySelectorAll("[aria-label='Start in house'] button")].map((b) => b.textContent.trim()).join("|")`,
  );
  assert(
    houses.split("|").length >= 3,
    `house picker lists houses (${houses})`,
  );
  assert(
    (await data("house")) === "moonbase",
    "Moonbase House is the default start",
  );
  await page.click("[role=dialog] button.btn-primary");
  assert(
    await waitFor(
      async () =>
        (await page.eval(`!!document.querySelector("canvas")`)) === true,
    ),
    "Phaser canvas renders",
  );
  assert(
    await waitFor(async () => (await data("phase")) === "countdown"),
    "round starts with Peeka counting",
  );
  assert((await data("time")) === "105", "timer starts at 1:45");
  assert((await data("round")) === "1", "round 1");
  await page.screenshot("hide-countdown");

  // Walk left along the hall to the plant pots.
  await hold("ArrowLeft", true);
  const near = await waitFor(
    async () => (await data("prompt")) === "hide",
    7000,
  );
  await hold("ArrowLeft", false);
  assert(near, "walking up to a hiding spot offers Hide");
  await page.screenshot("hide-near-spot");

  await press("KeyE");
  assert(
    await waitFor(async () => (await data("hidden")) === "true", 2000),
    "pressing E hides",
  );
  assert(
    (await data("prompt")) === "exit",
    "while hidden the button says Exit",
  );
  await page.screenshot("hide-hidden");
  await press("KeyE");
  assert(
    await waitFor(async () => (await data("hidden")) === "false", 2000),
    "pressing E again comes out",
  );
  await page.sleep(500);
  await press("KeyE");
  await waitFor(async () => (await data("hidden")) === "true", 2000);

  assert(
    await waitFor(async () => (await data("phase")) === "play", 12000),
    "Peeka starts seeking after the countdown",
  );
  await page.sleep(2500);
  await resumeIfHidden();
  const t1 = Number(await data("time"));
  assert(t1 < 105 && t1 > 90, `timer runs (${t1})`);
  await page.screenshot("hide-play");

  await page.key("p");
  await page.sleep(200);
  assert((await overlay()) === "Paused", "P pauses");
  const t2 = Number(await data("time"));
  await page.sleep(2000);
  assert(Number(await data("time")) === t2, "timer freezes while paused");
  await page.click("[role=dialog] button.btn-primary");
  await page.sleep(2200);
  await resumeIfHidden();
  assert(Number(await data("time")) < t2, "timer runs again after Resume");

  // Restart from the paused screen resets the round.
  await page.key("p");
  await page.sleep(200);
  const restart = await page.eval(
    `(() => { const b = [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Restart"); if (b) b.click(); return !!b; })()`,
  );
  assert(restart, "paused screen has Restart");
  assert(
    await waitFor(
      async () =>
        (await data("phase")) === "countdown" &&
        (await data("time")) === "105" &&
        (await data("hidden")) === "false",
      3000,
    ),
    "restart resets the timer, round and hiding",
  );
}
