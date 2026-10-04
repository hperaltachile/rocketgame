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
  const waitCanvas = async () => {
    for (
      let i = 0;
      i < 60 && !(await page.eval(`!!document.querySelector("canvas")`));
      i++
    )
      await page.sleep(100);
    await page.sleep(300);
  };

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/snake");
  assert((await overlay()) === "Ready?", "start screen shows");
  assert(
    !(await page.eval(`!!document.querySelector("canvas")`)),
    "no Phaser before Start",
  );
  await page.click("[role=dialog] button.btn-primary");
  await waitCanvas();
  assert(
    await page.eval(`!!document.querySelector("canvas")`),
    "canvas after Start",
  );

  // With no input the snake heads right into the wall.
  const t0 = Date.now();
  while ((await overlay()) === null && Date.now() - t0 < 8000)
    await page.sleep(100);
  assert(
    (await overlay()) === "Game over",
    `hits the wall without steering (${Date.now() - t0} ms)`,
  );
  await page.screenshot("snake-over");

  // Steer a small square loop: it should survive.
  await page.click("[role=dialog] button.btn-primary");
  await page.sleep(100);
  const loopStart = Date.now();
  const dirs = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
  let i = 0;
  while (Date.now() - loopStart < 5000) {
    await page.key(dirs[i++ % 4]);
    await page.sleep(450);
    if ((await overlay()) === "Paused" && (await page.eval("document.hidden")))
      await page.key("p");
  }
  assert(
    (await overlay()) === null,
    "arrow keys steer (survives 5 s circling)",
  );
  assert(
    (await page.eval("window.scrollY")) === 0,
    "arrow keys don't scroll the page",
  );
  await page.screenshot("snake-playing");

  await page.key("Escape");
  assert((await overlay()) === "Paused", "Esc pauses");
  await page.sleep(1500);
  await page.key("Escape");
  assert(
    (await overlay()) === null,
    "Esc resumes (and the snake didn't die while paused)",
  );

  // Mobile: D-pad visible on touch, swipes and pad steer.
  await page.viewport(375, 800, { mobile: true, dark: true });
  await page.goto(BASE + "/games/snake");
  await page.click("[role=dialog] button.btn-primary");
  await waitCanvas();
  const padVisible = await page.eval(
    `getComputedStyle(document.querySelector('[aria-label="Steer the snake"]')).display`,
  );
  assert(
    padVisible === "grid",
    `on-screen D-pad shown on touch devices (${padVisible})`,
  );
  const loop2 = Date.now();
  const pads = ["up", "left", "down", "right"];
  let k = 0;
  while (Date.now() - loop2 < 4000) {
    await page.click(`button[aria-label="Go ${pads[k++ % 4]}"]`);
    await page.sleep(430);
  }
  assert((await overlay()) === null, "D-pad steers (survives 4 s circling)");
  const sw = await page.eval("document.documentElement.scrollWidth");
  assert(sw <= 375, `no horizontal scroll at 375px (${sw})`);
  await page.screenshot("snake-mobile", true);

  // Desktop hides the pad.
  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/snake");
  const padDesktop = (await page.eval(
    `document.querySelector('[aria-label="Steer the snake"]').checkVisibility()`,
  ))
    ? "visible"
    : "none";
  assert(padDesktop === "none", "D-pad hidden with a mouse");

  if (page.errors.length) throw new Error("page had errors");
}
